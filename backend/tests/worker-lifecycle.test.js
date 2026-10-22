jest.mock("mongoose", () => ({ connection: { readyState: 1 } }));
jest.mock("../src/config/env", () => ({}));
jest.mock("../src/config/redis", () => ({ redisConnection: null }));
jest.mock("../src/queues/scanQueue", () => ({ SCAN_QUEUE_NAME: "test", SCAN_QUEUE_REGION: "bom1" }));
jest.mock("../src/models/Scan", () => ({ findOneAndUpdate: jest.fn() }));
jest.mock("../src/models/Finding", () => ({ bulkWrite: jest.fn(), aggregate: jest.fn() }));
jest.mock("../src/services/workspace.service", () => ({ createEphemeralWorkspace: jest.fn() }));
jest.mock("../src/scanners/orchestrator", () => jest.fn());
jest.mock("../src/scanners/semgrep.adapter", () => jest.fn());
jest.mock("../src/scanners/bandit.adapter", () => jest.fn());
const Scan = require("../src/models/Scan");
const Orchestrator = require("../src/scanners/orchestrator");
const SemgrepAdapter = require("../src/scanners/semgrep.adapter");
const BanditAdapter = require("../src/scanners/bandit.adapter");
const { createEphemeralWorkspace } = require("../src/services/workspace.service");
const { processScanJob, reportScannerReadiness } = require("../src/workers/scanWorker");
let record, cleanup, runAll;
const job = { id: "job", data: { scanId: "scan", organizationId: "org", installationId: "1", owner: "owner", repo: "repo" } };
beforeEach(() => {
  jest.clearAllMocks(); record = { _id: "scan", status: "running", commitSha: "a".repeat(40), save: jest.fn().mockResolvedValue() };
  Scan.findOneAndUpdate.mockResolvedValue(record);
  cleanup = jest.fn(); createEphemeralWorkspace.mockResolvedValue({ workspacePath: "/synthetic", cleanup });
  runAll = jest.fn().mockResolvedValue({ results: [], scannersRun: ["semgrep"], scannerErrors: [], coverage: [] });
  Orchestrator.mockImplementation(() => ({ runAll }));
});
test("a duplicate or cancelled job that cannot claim a lease does not run scanners", async () => {
  Scan.findOneAndUpdate.mockResolvedValue(null);
  expect(await processScanJob(job)).toMatchObject({ skipped: true });
  expect(createEphemeralWorkspace).not.toHaveBeenCalled();
});
test("worker startup reports each scanner's installed or unavailable state", async () => {
  SemgrepAdapter.mockImplementation(() => ({ name: "semgrep", version: "1.181.0", isAvailable: jest.fn().mockResolvedValue(true) }));
  BanditAdapter.mockImplementation(() => ({ name: "bandit", version: null, isAvailable: jest.fn().mockResolvedValue(false) }));
  const info = jest.spyOn(console, "info").mockImplementation(() => {});
  const error = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    await reportScannerReadiness();
    expect(info).toHaveBeenCalledWith("[ScanWorker] semgrep scanner ready (1.181.0).");
    expect(error).toHaveBeenCalledWith("[ScanWorker] bandit scanner unavailable; scan coverage will be partial.");
  } finally {
    info.mockRestore();
    error.mockRestore();
  }
});
test("scanner-wide failure records failure and releases the active key", async () => {
  runAll.mockRejectedValue(Object.assign(new Error("All failed"), { scannerErrors: [{ scanner: "semgrep", message: "Failed" }] }));
  await expect(processScanJob(job)).rejects.toThrow("All failed");
  const token = Scan.findOneAndUpdate.mock.calls[0][1].$set.leaseToken;
  expect(Scan.findOneAndUpdate).toHaveBeenCalledTimes(2);
  expect(Scan.findOneAndUpdate.mock.calls[1][0]).toMatchObject({ status: "running", cancelledAt: null, leaseToken: token });
  expect(Scan.findOneAndUpdate.mock.calls[1][1].$set).toMatchObject({ status: "failed", activeKey: null, leaseToken: null });
  expect(Scan.findOneAndUpdate.mock.calls[1][1].$set.scannerErrors).toHaveLength(1);
  expect(cleanup).toHaveBeenCalledTimes(1);
});
test("successful empty analysis pins the archive and finalizes only a still-active job", async () => {
  await expect(processScanJob(job)).resolves.toMatchObject({ success: true, summary: { total: 0 } });
  expect(createEphemeralWorkspace).toHaveBeenCalledWith("1", "owner", "repo", record.commitSha);
  const token = Scan.findOneAndUpdate.mock.calls[0][1].$set.leaseToken;
  expect(Scan.findOneAndUpdate.mock.calls[1][0]).toEqual({ _id: "scan", status: "running", cancelledAt: null, leaseToken: token });
  expect(Scan.findOneAndUpdate.mock.calls[1][1].$set.leaseToken).toBeNull();
  expect(cleanup).toHaveBeenCalledTimes(1);
});
test("cancellation wins a race with successful scanner completion", async () => {
  Scan.findOneAndUpdate.mockResolvedValueOnce(record).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
  await expect(processScanJob(job)).rejects.toThrow("cancelled");
  const token = Scan.findOneAndUpdate.mock.calls[0][1].$set.leaseToken;
  expect(Scan.findOneAndUpdate.mock.calls[2][0]).toMatchObject({ status: "running", cancelledAt: null, leaseToken: token });
  expect(cleanup).toHaveBeenCalledTimes(1);
});
test("a stale worker cannot finalize or fail a scan after its lease is reclaimed", async () => {
  let currentToken;
  Scan.findOneAndUpdate.mockImplementation(async (filter, update) => {
    if (filter.leaseToken === undefined) {
      currentToken = update.$set.leaseToken;
      return record;
    }
    if (filter.leaseToken !== currentToken) return null;
    return record;
  });
  runAll.mockImplementation(async () => {
    currentToken = "new-worker-lease";
    return { results: [], scannersRun: ["semgrep"], scannerErrors: [], coverage: [] };
  });
  await expect(processScanJob(job)).rejects.toThrow("cancelled");
  const oldToken = Scan.findOneAndUpdate.mock.calls[0][1].$set.leaseToken;
  expect(oldToken).not.toBe("new-worker-lease");
  expect(Scan.findOneAndUpdate.mock.calls.slice(1).every(([filter]) => filter.leaseToken === oldToken)).toBe(true);
  expect(cleanup).toHaveBeenCalledTimes(1);
});

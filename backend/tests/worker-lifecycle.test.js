jest.mock("mongoose", () => ({ connection: { readyState: 1 } }));
jest.mock("../src/config/env", () => ({}));
jest.mock("../src/config/redis", () => ({ redisConnection: null }));
jest.mock("../src/queues/scanQueue", () => ({ SCAN_QUEUE_NAME: "test", SCAN_QUEUE_REGION: "bom1" }));
jest.mock("../src/models/Scan", () => ({ findOneAndUpdate: jest.fn() }));
jest.mock("../src/models/Finding", () => ({ bulkWrite: jest.fn(), aggregate: jest.fn() }));
jest.mock("../src/services/workspace.service", () => ({ createEphemeralWorkspace: jest.fn() }));
jest.mock("../src/scanners/orchestrator", () => jest.fn());
const Scan = require("../src/models/Scan");
const Orchestrator = require("../src/scanners/orchestrator");
const { createEphemeralWorkspace } = require("../src/services/workspace.service");
const { processScanJob } = require("../src/workers/scanWorker");
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
test("scanner-wide failure records failure and releases the active key", async () => {
  runAll.mockRejectedValue(Object.assign(new Error("All failed"), { scannerErrors: [{ scanner: "semgrep", message: "Failed" }] }));
  await expect(processScanJob(job)).rejects.toThrow("All failed");
  expect(record.status).toBe("failed"); expect(record.activeKey).toBeNull();
  expect(record.scannerErrors).toHaveLength(1); expect(cleanup).toHaveBeenCalledTimes(1);
});
test("successful empty analysis pins the archive and finalizes only a still-active job", async () => {
  await expect(processScanJob(job)).resolves.toMatchObject({ success: true, summary: { total: 0 } });
  expect(createEphemeralWorkspace).toHaveBeenCalledWith("1", "owner", "repo", record.commitSha);
  expect(Scan.findOneAndUpdate.mock.calls[1][0]).toEqual({ _id: "scan", status: "running", cancelledAt: null });
  expect(cleanup).toHaveBeenCalledTimes(1);
});
test("cancellation wins a race with successful scanner completion", async () => {
  Scan.findOneAndUpdate.mockResolvedValueOnce(record).mockResolvedValueOnce(null);
  await expect(processScanJob(job)).rejects.toThrow("cancelled");
  expect(record.status).toBe("failed"); expect(cleanup).toHaveBeenCalledTimes(1);
});

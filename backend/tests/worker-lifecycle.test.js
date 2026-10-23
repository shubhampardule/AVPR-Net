jest.mock("../src/models/Organization", () => ({ exists: jest.fn().mockResolvedValue(true) }));
jest.mock("mongoose", () => ({ connection: { readyState: 1, transaction: jest.fn(callback => callback({ fixture: true })) } }));
jest.mock("../src/config/env", () => ({}));
jest.mock("../src/config/redis", () => ({ redisConnection: null }));
jest.mock("../src/queues/scanQueue", () => ({ SCAN_QUEUE_NAME: "test", SCAN_QUEUE_REGION: "bom1" }));
jest.mock("../src/models/Scan", () => ({ findOneAndUpdate: jest.fn() }));
jest.mock("../src/models/Finding", () => ({ init: jest.fn().mockResolvedValue(), bulkWrite: jest.fn(), aggregate: jest.fn() }));
jest.mock("../src/services/workspace.service", () => ({ createEphemeralWorkspace: jest.fn() }));
jest.mock("../src/services/notification.service", () => ({ notifyScanResult: jest.fn().mockResolvedValue({ delivered: 1 }) }));
jest.mock("../src/scanners/orchestrator", () => jest.fn());
jest.mock("../src/scanners/semgrep.adapter", () => jest.fn());
jest.mock("../src/scanners/bandit.adapter", () => jest.fn());
jest.mock("../src/services/scan-expiry.service", () => ({ expireOverdueScans: jest.fn().mockResolvedValue(0) }));
jest.mock("../src/services/organization-deletion.service", () => ({ purgeDueOrganizations: jest.fn().mockResolvedValue({}) }));
jest.mock("../src/services/automation.service", () => ({ runDueSchedules: jest.fn().mockResolvedValue() }));
jest.mock("../src/services/patch-rescan-jobs.service",()=>({runPending:jest.fn().mockResolvedValue()}));
const Scan = require("../src/models/Scan");
const Finding = require("../src/models/Finding");
const { notifyScanResult } = require("../src/services/notification.service");
const Orchestrator = require("../src/scanners/orchestrator");
const SemgrepAdapter = require("../src/scanners/semgrep.adapter");
const BanditAdapter = require("../src/scanners/bandit.adapter");
const { createEphemeralWorkspace } = require("../src/services/workspace.service");
const { processScanJob, reportScannerReadiness, runMaintenance } = require("../src/workers/scanWorker");
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
  expect(notifyScanResult).toHaveBeenCalledWith(expect.objectContaining({ status: "failed", _id: "scan" }));
});
test("successful empty analysis pins the archive and finalizes only a still-active job", async () => {
  await expect(processScanJob(job)).resolves.toMatchObject({ success: true, summary: { total: 0 } });
  expect(createEphemeralWorkspace).toHaveBeenCalledWith("1", "owner", "repo", record.commitSha);
  const token = Scan.findOneAndUpdate.mock.calls[0][1].$set.leaseToken;
  expect(Scan.findOneAndUpdate.mock.calls[1][0]).toMatchObject({ _id: "scan", status: "running", cancelledAt: null, leaseToken: token,
    $or: [{ deadlineAt: null }, { deadlineAt: { $gt: expect.any(Date) } }] });
  expect(Scan.findOneAndUpdate.mock.calls[1][1].$set.leaseToken).toBeNull();
  expect(Scan.findOneAndUpdate.mock.calls[1][1].$set.scannerPolicyHash).toMatch(/^[a-f0-9]{64}$/);
  expect(cleanup).toHaveBeenCalledTimes(1);
  expect(notifyScanResult).toHaveBeenCalledWith(expect.objectContaining({ status: "completed", scannersUsed: ["semgrep"] }));
});

test("shared worker maintenance expires overdue scans before dispatching automation", async () => {
  await runMaintenance();
  const expiry = require("../src/services/scan-expiry.service").expireOverdueScans;
  const dispatch = require("../src/services/automation.service").runDueSchedules;
  expect(expiry).toHaveBeenCalledTimes(1);
  expect(dispatch).toHaveBeenCalledTimes(1);
  expect(expiry.mock.invocationCallOrder[0]).toBeLessThan(dispatch.mock.invocationCallOrder[0]);
});
test("notification failures cannot change a completed scan or leak provider error text", async () => {
  notifyScanResult.mockRejectedValueOnce(new Error("private notification database detail"));
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    await expect(processScanJob(job)).resolves.toMatchObject({ success: true, summary: { total: 0 } });
    expect(Scan.findOneAndUpdate.mock.calls[1][1].$set).toMatchObject({ status: "completed", activeKey: null, leaseToken: null });
    expect(log).toHaveBeenCalledWith("[ScanWorker] Notification delivery failed for scan scan (Error).");
    expect(log.mock.calls.flat().join(" ")).not.toContain("private notification database detail");
  } finally { log.mockRestore(); }
});
test("scan findings persist reviewed deterministic guidance with the original rule evidence", async () => {
  runAll.mockResolvedValue({ scannersRun: ["semgrep"], scannerErrors: [], coverage: [], results: [{ scanner: "semgrep", findings: [{
    path: "src/query.js", start: { line: 12, col: 1 }, end: { line: 12 }, check_id: "securepatch.js.sql-concatenation",
    extra: { severity: "ERROR", message: "Parameterize SQL queries instead of concatenating values.", lines: "db.query(sql + input)", metadata: { cwe: ["CWE-89"] } },
  }] }] });
  Finding.aggregate.mockResolvedValue([]);
  await processScanJob(job);
  const inserted = Finding.bulkWrite.mock.calls[0][0][0].updateOne.update.$setOnInsert;
  expect(inserted).toMatchObject({
    scanner: "semgrep", ruleId: "securepatch.js.sql-concatenation", filePath: "src/query.js", startLine: 12,
    remediationGuidance: { source: "deterministic", version: "securepatch-guidance-v1", title: "Bind SQL parameters" },
  });
  expect(inserted.evidenceSnippet).toContain("db.query(sql + input)");
});
test("a resolved issue found again is inserted as open evidence for the new scan without rewriting history", async () => {
  runAll.mockResolvedValue({ scannersRun: ["semgrep"], scannerErrors: [], coverage: [], results: [{ scanner: "semgrep", findings: [{
    path: "src/query.js", start: { line: 12, col: 1 }, end: { line: 12 }, check_id: "securepatch.js.sql-concatenation",
    extra: { severity: "ERROR", message: "Parameterize SQL queries instead of concatenating values.", lines: "db.query(sql + input)", metadata: { cwe: ["CWE-89"] } },
  }] }] });
  Finding.aggregate.mockImplementation(async pipeline => [{ _id: pipeline[0].$match.correlationKey.$in[0], review: {
    status: "resolved", statusReason: "Fixed in a prior change", reviewedAt: new Date("2026-10-20T00:00:00Z"),
  } }]);

  await processScanJob(job);

  const operation = Finding.bulkWrite.mock.calls[0][0][0].updateOne;
  expect(operation.filter).toMatchObject({ scan: "scan" });
  expect(operation.update.$setOnInsert).toMatchObject({ scan: "scan", status: "open" });
  expect(operation.update.$setOnInsert).not.toHaveProperty("statusReason");
  expect(operation.update.$setOnInsert).not.toHaveProperty("reviewHistory");
});
test("cancellation wins a race with successful scanner completion", async () => {
  Scan.findOneAndUpdate.mockResolvedValueOnce(record).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
  await expect(processScanJob(job)).rejects.toThrow("cancelled");
  const token = Scan.findOneAndUpdate.mock.calls[0][1].$set.leaseToken;
  expect(Scan.findOneAndUpdate.mock.calls[2][0]).toMatchObject({ status: "running", cancelledAt: null, leaseToken: token });
  expect(cleanup).toHaveBeenCalledTimes(1);
  expect(notifyScanResult).not.toHaveBeenCalled();
});

test("cancellation prevents nonempty scanner findings from being persisted", async () => {
  runAll.mockResolvedValue({ scannersRun: ["semgrep"], scannerErrors: [], coverage: [], results: [{ scanner: "semgrep", findings: [{
    path: "src/query.js", start: { line: 12, col: 1 }, end: { line: 12 }, check_id: "securepatch.js.sql-concatenation",
    extra: { severity: "ERROR", message: "Bind SQL parameters", lines: "db.query(sql + input)", metadata: { cwe: ["CWE-89"] } },
  }] }] });
  Finding.aggregate.mockResolvedValue([]);
  Scan.findOneAndUpdate.mockResolvedValueOnce(record).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
  await expect(processScanJob(job)).rejects.toThrow("cancelled");
  expect(Finding.bulkWrite).not.toHaveBeenCalled();
  expect(notifyScanResult).not.toHaveBeenCalled();
  expect(cleanup).toHaveBeenCalledTimes(1);
});

test("a finding persistence failure cannot report completion or send success notifications", async () => {
  runAll.mockResolvedValue({ scannersRun: ["semgrep"], scannerErrors: [], coverage: [], results: [{ scanner: "semgrep", findings: [{
    path: "src/query.js", start: { line: 12, col: 1 }, end: { line: 12 }, check_id: "securepatch.js.sql-concatenation",
    extra: { severity: "ERROR", message: "Bind SQL parameters", lines: "db.query(sql + input)", metadata: { cwe: ["CWE-89"] } },
  }] }] });
  Finding.aggregate.mockResolvedValue([]);
  Finding.bulkWrite.mockRejectedValueOnce(new Error("fixture write failure"));
  await expect(processScanJob(job)).rejects.toThrow("fixture write failure");
  expect(Finding.bulkWrite.mock.calls[0][1]).toMatchObject({ session: { fixture: true } });
  expect(Scan.findOneAndUpdate.mock.calls[1][2]).toMatchObject({ session: { fixture: true } });
  expect(notifyScanResult).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
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

test("a queued job for a deleting organization cannot download source or run scanners", async () => {
  require("../src/models/Organization").exists.mockResolvedValueOnce(false);
  expect(await processScanJob(job)).toMatchObject({ skipped: true });
  expect(Scan.findOneAndUpdate).not.toHaveBeenCalled();
  expect(createEphemeralWorkspace).not.toHaveBeenCalled();
});

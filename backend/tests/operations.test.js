jest.mock("mongoose", () => ({ connection: { readyState: 0 } }));
jest.mock("../src/models/UsageBucket", () => ({ updateOne: jest.fn(), findById: jest.fn(), find: jest.fn() }));
jest.mock("../src/models/Scan", () => ({ findOne: jest.fn(), countDocuments: jest.fn() }));
const mongoose = require("mongoose");
const Buckets = require("../src/models/UsageBucket");
const Scan = require("../src/models/Scan");
const { evaluate, snapshot, recordSignal } = require("../src/services/operations.service");
const now = Date.parse("2026-10-22T18:30:00Z");
const metrics = () => ({ workerAvailable: true, oldestQueuedAgeMs: null, failedScans: 0, partialScans: 0, signals: {} });
function query(value) {
  const chain = { select: jest.fn().mockReturnThis(), sort: jest.fn().mockReturnThis(), maxTimeMS: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(value) };
  return chain;
}
afterEach(() => { jest.restoreAllMocks(); jest.clearAllMocks(); });
test("healthy idle queues do not report errors and each failure signal is actionable", () => {
  expect(evaluate(metrics())).toMatchObject({ status: "ok", alerts: [] });
  const result = evaluate({ ...metrics(), workerAvailable: false, oldestQueuedAgeMs: 300000, failedScans: 5, partialScans: 5,
    signals: { provider_failure: 5, webhook_reject: 5, request_failure: 5 } });
  expect(result.alerts).toEqual(["WORKER_HEARTBEAT_STALE", "QUEUE_AGE_HIGH", "SCAN_FAILURES_HIGH", "SCANNER_ERRORS_HIGH", "PROVIDER_FAILURES_HIGH", "WEBHOOK_REJECTS_HIGH", "REQUEST_FAILURES_HIGH"]);
});
test("a disconnected database cannot produce a healthy monitor result or buffer telemetry", async () => {
  mongoose.connection.readyState = 0;
  expect(await snapshot()).toEqual({ status: "unavailable", alerts: ["DATABASE_UNAVAILABLE"] });
  expect(await recordSignal("provider_failure")).toBe(false);
  expect(Buckets.updateOne).not.toHaveBeenCalled();
});
test("snapshot handles stale heartbeats and aggregates only bounded safe signal buckets", async () => {
  mongoose.connection.readyState = 1;
  Buckets.findById.mockReturnValue(query({ expires: new Date(now - 1) }));
  Scan.findOne.mockReturnValue(query({ createdAt: new Date(now - 600000) }));
  Scan.countDocuments.mockReturnValue({ maxTimeMS: jest.fn().mockResolvedValue(0) });
  Buckets.find.mockReturnValue(query([{ _id: "ops:provider_failure:1", count: 6 }, { _id: "ops:unknown:1", count: 100 }]));
  const result = await snapshot({ now });
  expect(result.alerts).toEqual(["WORKER_HEARTBEAT_STALE", "QUEUE_AGE_HIGH", "PROVIDER_FAILURES_HIGH"]);
  expect(result.metrics.signals).toEqual({ provider_failure: 6, webhook_reject: 0, request_failure: 0 });
  expect(Buckets.find.mock.calls[0][0]._id.$in).toHaveLength(48);
  expect(Scan.countDocuments.mock.calls[0][0]).toMatchObject({ cancelledAt: null });
});
test("query errors return a sanitized unavailable result without database error contents", async () => {
  mongoose.connection.readyState = 1;
  Buckets.findById.mockImplementation(() => { throw new Error("private database URI"); });
  expect(await snapshot({ now })).toEqual({ status: "unavailable", alerts: ["DATABASE_QUERY_FAILED"] });
});
test("telemetry only stores fixed codes, a minute, a count, and expiry; write failure is best effort", async () => {
  mongoose.connection.readyState = 1;
  expect(await recordSignal("private-user-input", now)).toBe(false);
  expect(Buckets.updateOne).not.toHaveBeenCalled();
  Buckets.updateOne.mockResolvedValue({});
  expect(await recordSignal("webhook_reject", now)).toBe(true);
  expect(Buckets.updateOne).toHaveBeenCalledWith({ _id: `ops:webhook_reject:${Math.floor(now / 60000)}` },
    { $inc: { count: 1 }, $set: { expires: new Date(now + 3600000) } }, { upsert: true, maxTimeMS: 500 });
  Buckets.updateOne.mockRejectedValue(new Error("failed"));
  expect(await recordSignal("provider_failure", now)).toBe(false);
});

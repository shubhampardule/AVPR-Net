jest.mock("../src/models/RepositoryAutomation", () => ({ find: jest.fn(), findOneAndUpdate: jest.fn(), updateOne: jest.fn() }));
jest.mock("../src/models/Organization", () => ({}));
jest.mock("../src/models/UsageBucket", () => ({ create: jest.fn(), deleteOne: jest.fn() }));
jest.mock("../src/services/scan.service", () => ({ enqueueScan: jest.fn() }));
const Automation = require("../src/models/RepositoryAutomation");
const Usage = require("../src/models/UsageBucket");
const Scans = require("../src/services/scan.service");
const { runDueSchedules, receive } = require("../src/services/automation.service");
beforeEach(() => {
  jest.resetAllMocks();
  Automation.find.mockReturnValue({ limit: jest.fn().mockResolvedValue([]) });
  Automation.findOneAndUpdate.mockResolvedValue(null);
  Scans.enqueueScan.mockResolvedValue({ scanId: "new-scan" });
});
test("an event enqueue failure leaves its pinned commit pending for a later pass", async () => {
  const pending = { _id: "config", organization: "org", owner: "team", repo: "project", pendingRefs: ["a".repeat(40)] };
  Automation.find.mockReturnValue({ limit: jest.fn().mockResolvedValue([pending]) });
  Scans.enqueueScan.mockRejectedValueOnce(new Error("quota"));
  await runDueSchedules();
  expect(Automation.updateOne).not.toHaveBeenCalled();
  await runDueSchedules();
  expect(Scans.enqueueScan).toHaveBeenLastCalledWith(expect.objectContaining({ ref: "a".repeat(40) }));
  expect(Automation.updateOne).toHaveBeenCalledWith({ _id: "config" }, expect.objectContaining({ $pull: { pendingRefs: "a".repeat(40) } }));
});
test("a failed due schedule releases its lease and retries after fifteen minutes", async () => {
  const before = Date.now();
  const config = { organization: "org", owner: "team", repo: "project", frequency: "weekly", save: jest.fn() };
  Automation.findOneAndUpdate.mockResolvedValueOnce(config);
  Scans.enqueueScan.mockRejectedValue(new Error("private upstream error"));
  await runDueSchedules();
  expect(config.leaseUntil).toBeNull();
  expect(config.nextRunAt.getTime()).toBeGreaterThanOrEqual(before + 900000);
  expect(config.lastError).not.toContain("private upstream");
  expect(config.save).toHaveBeenCalledTimes(1);
  expect(Automation.findOneAndUpdate.mock.calls[0][0]).toMatchObject({ frequency: { $ne: "off" }, $or: expect.any(Array) });
});
test("a worker pass bounds schedule claims to five and records the successful scan", async () => {
  const configs = Array.from({ length: 7 }, () => ({ organization: "org", owner: "team", repo: "project", frequency: "monthly", save: jest.fn() }));
  for (const config of configs) Automation.findOneAndUpdate.mockResolvedValueOnce(config);
  await runDueSchedules();
  expect(Scans.enqueueScan).toHaveBeenCalledTimes(5);
  expect(configs[0]).toMatchObject({ lastScanId: "new-scan", lastError: null, leaseUntil: null });
  expect(configs[5].save).not.toHaveBeenCalled();
});
const event = () => ({ repository: { owner: { login: "Team" }, name: "Project", default_branch: "main" }, installation: { id: 12 }, ref: "refs/heads/main", after: "a".repeat(40) });
test("duplicate deliveries do not enqueue a second reference", async () => {
  Usage.create.mockRejectedValue({ code: 11000 });
  expect(await receive(Buffer.from(JSON.stringify(event())), "push", "delivery-1")).toEqual({ duplicate: true });
  expect(Automation.find).not.toHaveBeenCalled();
});
test("a full per-repository event queue makes delivery retryable instead of losing its commit", async () => {
  Automation.find.mockReturnValue({ limit: jest.fn().mockResolvedValue([{ _id: "config" }]) });
  await expect(receive(Buffer.from(JSON.stringify(event())), "push", "delivery-2")).rejects.toMatchObject({ code: "EVENT_QUEUE_FULL" });
  expect(Usage.deleteOne).toHaveBeenCalledWith({ _id: "delivery:delivery-2" });
  expect(Automation.find.mock.calls[0][0]).toMatchObject({ installationId: "12", push: true });
});
test.each(["refs/heads/feature", "refs/tags/v1"])("unselected push ref %s does not consume delivery state", async ref => {
  expect(await receive(Buffer.from(JSON.stringify({ ...event(), ref })), "push", "delivery-3")).toEqual({ skipped: true });
  expect(Usage.create).not.toHaveBeenCalled();
});

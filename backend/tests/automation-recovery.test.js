jest.mock("../src/models/RepositoryAutomation", () => ({ find: jest.fn(), findOneAndUpdate: jest.fn(), updateOne: jest.fn() }));
jest.mock("../src/models/Organization", () => ({ findById: jest.fn() }));
jest.mock("../src/models/UsageBucket", () => ({ create: jest.fn(), deleteOne: jest.fn() }));
jest.mock("../src/services/scan.service", () => ({ enqueueScan: jest.fn() }));
jest.mock("../src/services/github.service", () => ({ resolveCommit: jest.fn() }));
jest.mock("../src/services/github-webhook-readiness.service", () => ({ getWebhookReadiness: jest.fn() }));
const Automation = require("../src/models/RepositoryAutomation");
const Organization = require("../src/models/Organization");
const Usage = require("../src/models/UsageBucket");
const Scans = require("../src/services/scan.service");
const { runDueSchedules, receive, settings } = require("../src/services/automation.service");
const config = overrides => ({ _id: "config", organization: "org", owner: "team", repo: "project", frequency: "weekly", push: true, pullRequest: false, pendingRefs: ["a".repeat(40)], ...overrides });
function provide(kind, configs) {
  Automation.findOneAndUpdate.mockImplementation(async (filter, update) => {
    const matches = kind === "event" ? filter["pendingRefs.0"] : filter.frequency;
    const item = matches ? configs.shift() : null;
    return item ? { ...item, leaseToken: update.$set.leaseToken } : null;
  });
}
beforeEach(() => {
  jest.resetAllMocks();
  Automation.findOneAndUpdate.mockResolvedValue(null);
  Automation.updateOne.mockResolvedValue({ matchedCount: 1 });
  Scans.enqueueScan.mockResolvedValue({ scanId: "new-scan" });
});

test("acceptance checks can substitute enqueue without calling a real scan provider", async () => {
  provide("schedule", [config()]);
  const enqueueScan = jest.fn().mockResolvedValue({ scanId: "fixture-only" });
  await runDueSchedules({ enqueueScan });
  expect(enqueueScan).toHaveBeenCalledTimes(1);
  expect(Scans.enqueueScan).not.toHaveBeenCalled();
  expect(Automation.updateOne.mock.calls[0][1].$set.lastScanId).toBe("fixture-only");
});
test("event enqueue failure preserves its commit, records recovery guidance and releases only its claim", async () => {
  provide("event", [config()]);
  Scans.enqueueScan.mockRejectedValueOnce(new Error("private quota response"));
  await runDueSchedules();
  const [filter, update] = Automation.updateOne.mock.calls[0];
  expect(filter).toMatchObject({ _id: "config", leaseToken: expect.any(String) });
  expect(update.$pull).toBeUndefined();
  expect(update.$set).toMatchObject({ leaseUntil: null, leaseToken: null, lastError: expect.stringContaining("Event scan") });
  expect(update.$set.lastError).not.toContain("private");
  provide("event", [config()]);
  await runDueSchedules();
  expect(Scans.enqueueScan).toHaveBeenLastCalledWith(expect.objectContaining({ ref: "a".repeat(40) }));
  expect(Automation.updateOne).toHaveBeenLastCalledWith(expect.objectContaining({ leaseToken: expect.any(String) }),
    expect.objectContaining({ $pull: { pendingRefs: "a".repeat(40) } }));
});
test("a failed due schedule releases its token and retries after fifteen minutes", async () => {
  const before = Date.now();
  provide("schedule", [config()]);
  Scans.enqueueScan.mockRejectedValue(new Error("private upstream error"));
  await runDueSchedules();
  const [filter, update] = Automation.updateOne.mock.calls[0];
  expect(filter.leaseToken).toEqual(expect.any(String));
  expect(update.$set).toMatchObject({ leaseUntil: null, leaseToken: null });
  expect(update.$set.nextRunAt.getTime()).toBeGreaterThanOrEqual(before + 900000);
  expect(update.$set.lastError).not.toContain("private upstream");
});
test("a worker pass bounds each queue to five distinct claims", async () => {
  provide("schedule", Array.from({ length: 7 }, (_, index) => config({ _id: String(index) })));
  await runDueSchedules();
  expect(Scans.enqueueScan).toHaveBeenCalledTimes(5);
  const scheduleCalls = Automation.findOneAndUpdate.mock.calls.filter(([filter]) => filter.frequency);
  expect(scheduleCalls[1][0]._id).toEqual({ $nin: ["0"] });
  expect(Automation.updateOne.mock.calls[0][1].$set).toMatchObject({ lastScanId: "new-scan", lastError: null, leaseToken: null });
});
test("pending event claims require an enabled event trigger and an available lease", async () => {
  await runDueSchedules();
  const [filter, update] = Automation.findOneAndUpdate.mock.calls[0];
  expect(filter).toMatchObject({ "pendingRefs.0": { $exists: true },
    $and: [{ $or: [{ push: true }, { pullRequest: true }] }], $or: expect.any(Array) });
  expect(update.$set).toMatchObject({ leaseUntil: expect.any(Date), leaseToken: expect.any(String) });
});
test("a stale event worker cannot finalize another worker's reclaimed lease", async () => {
  let activeToken, firstToken;
  provide("event", [config()]);
  Scans.enqueueScan.mockImplementation(async () => {
    firstToken = Automation.findOneAndUpdate.mock.calls[0][1].$set.leaseToken;
    activeToken = "replacement-worker-token";
    return { scanId: "old-job" };
  });
  Automation.updateOne.mockImplementation(async filter => ({ matchedCount: filter.leaseToken === activeToken ? 1 : 0 }));
  await runDueSchedules();
  expect(Automation.updateOne.mock.calls[0][0].leaseToken).toBe(firstToken);
  expect(firstToken).not.toBe(activeToken);
  expect(activeToken).toBe("replacement-worker-token");
});
test("a settings change invalidates in-flight claims and disabling both events clears pending commits", async () => {
  Organization.findById.mockResolvedValue({ githubInstallationId: "12" });
  require("../src/services/github.service").resolveCommit.mockResolvedValue({});
  Automation.findOneAndUpdate.mockResolvedValue({});
  await settings("org", "Team", "Project", { push: false, pullRequest: false, frequency: "off" });
  expect(Automation.findOneAndUpdate).toHaveBeenCalledWith({ organization: "org", owner: "team", repo: "project" },
    { $set: expect.objectContaining({ leaseToken: null, leaseUntil: null, pendingRefs: [], nextRunAt: null }) },
    expect.any(Object));
  expect(require("../src/services/github-webhook-readiness.service").getWebhookReadiness).not.toHaveBeenCalled();
});

test("an unsubscribed event is rejected before automation settings change", async () => {
  require("../src/services/github-webhook-readiness.service").getWebhookReadiness.mockResolvedValue({ push: true, pullRequest: false });
  await expect(settings("org", "team", "project", { push: false, pullRequest: true, frequency: "off" }))
    .rejects.toMatchObject({ code: "WEBHOOK_NOT_CONFIGURED" });
  expect(Automation.findOneAndUpdate).not.toHaveBeenCalled();
});

test("a subscribed push event can be enabled independently of pull requests", async () => {
  require("../src/services/github-webhook-readiness.service").getWebhookReadiness.mockResolvedValue({ push: true, pullRequest: false });
  Organization.findById.mockResolvedValue({ githubInstallationId: "12" });
  require("../src/services/github.service").resolveCommit.mockResolvedValue({});
  await settings("org", "team", "project", { push: true, pullRequest: false, frequency: "off" });
  expect(Automation.findOneAndUpdate).toHaveBeenCalledWith(expect.any(Object),
    { $set: expect.objectContaining({ push: true, pullRequest: false }) }, expect.any(Object));
});
test("a successful event removes only its pinned commit and does not change schedule timing", async () => {
  provide("event", [config({ pendingRefs: ["a".repeat(40), "b".repeat(40)] })]);
  await runDueSchedules();
  const [, update] = Automation.updateOne.mock.calls[0];
  expect(update.$pull).toEqual({ pendingRefs: "a".repeat(40) });
  expect(update.$set).not.toHaveProperty("nextRunAt");
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
  expect(Automation.findOneAndUpdate.mock.calls[0][0]).toMatchObject({ _id: "config", installationId: "12", push: true });
});
test.each(["refs/heads/feature", "refs/tags/v1"])("unselected push ref %s does not consume delivery state", async ref => {
  expect(await receive(Buffer.from(JSON.stringify({ ...event(), ref })), "push", "delivery-3")).toEqual({ skipped: true });
  expect(Usage.create).not.toHaveBeenCalled();
});

// Called only after the parent acceptance CLI establishes its disposable database.
const assert = require("node:assert/strict");
const Automation = require("../models/RepositoryAutomation");
const Usage = require("../models/UsageBucket");
const { runDueSchedules, receive } = require("../services/automation.service");

// Hold a real database claim while the competing operation completes. Only the
// external scan enqueue boundary is substituted; lease queries use real MongoDB.
async function whileClaimHeld(operation) {
  let signalEntered, release;
  const entered = new Promise(resolve => { signalEntered = resolve; });
  const held = new Promise(resolve => { release = resolve; });
  let calls = 0, timer;
  const worker = runDueSchedules({ enqueueScan: async () => {
    calls++; signalEntered(); await held; return { scanId: "original-worker" };
  } });
  worker.catch(() => {});
  try {
    await Promise.race([entered, worker.then(() => { throw new Error("Expected claim was not acquired"); }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Timed out waiting for claim")), 10000); })]);
    await operation();
  } finally {
    clearTimeout(timer); release(); await worker;
  }
  assert.equal(calls, 1);
}

async function runAutomationChecks(organization) {
  const checks = [];
  const filter = { organization, owner: "fixture", repo: "automation" };
  const create = async extra => Automation.create({ ...filter, installationId: "123", frequency: "weekly",
    nextRunAt: new Date(Date.now() - 1000), ...extra });
  const clear = () => Automation.deleteMany(filter);
  const read = () => Automation.findOne(filter).lean();

  await create();
  await whileClaimHeld(async () => {
    let competingCalls = 0;
    await runDueSchedules({ enqueueScan: async () => { competingCalls++; return { scanId: "unexpected" }; } });
    assert.equal(competingCalls, 0);
  });
  let state = await read();
  assert.equal(state.lastScanId, "original-worker");
  assert.equal(state.leaseToken, null);
  assert.ok(state.nextRunAt > new Date());
  checks.push("concurrent_dispatcher_cannot_claim_an_active_lease");
  await clear();

  await create();
  await whileClaimHeld(async () => {
    await Automation.updateOne(filter, { $set: { leaseUntil: new Date(Date.now() - 1000) } });
    await runDueSchedules({ enqueueScan: async () => ({ scanId: "replacement-worker" }) });
  });
  state = await read();
  assert.equal(state.lastScanId, "replacement-worker");
  assert.equal(state.leaseToken, null);
  checks.push("expired_claim_recovery_rejects_original_worker_completion");
  await clear();

  await create();
  await whileClaimHeld(async () => {
    await Automation.updateOne(filter, { $set: { frequency: "off", nextRunAt: null, leaseUntil: null,
      leaseToken: null, lastError: "fixture-settings-change" } });
  });
  state = await read();
  assert.equal(state.frequency, "off"); assert.equal(state.nextRunAt, null);
  assert.equal(state.lastScanId, null); assert.equal(state.lastError, "fixture-settings-change");
  checks.push("settings_invalidation_prevents_inflight_completion_overwrite");
  await clear();

  const first = "a".repeat(40), second = "b".repeat(40);
  const deadline = new Date(Date.now() + 3600000);
  await create({ push: true, pendingRefs: [first], nextRunAt: deadline });
  await whileClaimHeld(async () => {
    await Automation.updateOne(filter, { $addToSet: { pendingRefs: second } });
  });
  state = await read();
  assert.deepEqual(state.pendingRefs, [second]);
  assert.equal(state.nextRunAt.getTime(), deadline.getTime());
  checks.push("event_completion_preserves_concurrent_commit_and_schedule_deadline");
  await clear();

  await create();
  const before = Date.now();
  await runDueSchedules({ enqueueScan: async () => { throw new Error("fixture-upstream-failure"); } });
  state = await read();
  assert.equal(state.leaseToken, null);
  assert.ok(state.nextRunAt.getTime() >= before + 15 * 60000);
  assert.ok(!state.lastError.includes("fixture-upstream-failure"));
  checks.push("enqueue_failure_releases_claim_and_defers_retry_without_raw_error");
  await clear();

  await create({ frequency: "off", nextRunAt: null, push: true });
  const payload = ref => Buffer.from(JSON.stringify({ repository: { owner: { login: "fixture" }, name: "automation",
    default_branch: "main" }, installation: { id: 123 }, ref: "refs/heads/main", after: ref }));
  const deliveries = await Promise.all([receive(payload(first), "push", "fixture-replay"),
    receive(payload(first), "push", "fixture-replay")]);
  assert.equal(deliveries.filter(result => result.duplicate).length, 1);
  assert.equal(deliveries.filter(result => result.accepted === 1).length, 1);
  assert.deepEqual((await read()).pendingRefs, [first]);
  checks.push("concurrent_duplicate_webhooks_store_one_commit");

  const refs = Array.from({ length: 20 }, (_, index) => index.toString(16).padStart(40, "0"));
  await Automation.updateOne(filter, { $set: { pendingRefs: refs } });
  await assert.rejects(receive(payload(second), "push", "fixture-full"), error => error.code === "EVENT_QUEUE_FULL");
  assert.equal(await Usage.countDocuments({ _id: "delivery:fixture-full" }), 0);
  assert.deepEqual((await read()).pendingRefs, refs);
  await Automation.updateOne(filter, { $pull: { pendingRefs: refs[0] } });
  assert.equal((await receive(payload(second), "push", "fixture-full")).accepted, 1);
  assert.ok((await read()).pendingRefs.includes(second));
  checks.push("full_event_queue_preserves_delivery_retry_after_capacity_recovers");
  await clear();
  return checks;
}

module.exports = { runAutomationChecks };

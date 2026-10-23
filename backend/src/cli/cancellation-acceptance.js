// Real HTTP routes/middleware/storage; fixture identity replaces OAuth only.
const assert = require("node:assert/strict");
const request = require("supertest");
const Scan = require("../models/Scan");
const Audit = require("../models/AuditEvent");
const { persistScanCompletion } = require("../services/scan-completion.service");

async function runCancellationChecks({ organization, actor, outsider }) {
  const app = require("./acceptance-http").createFixtureApp([actor, outsider], "/scans", require("../routes/scan.routes"));
  const checks = [];
  const scan = await Scan.create({ organization, owner: "fixture", repo: "api-cancellation", installationId: "123",
    status: "running", leaseToken: "fixture-api-lease", activeKey: `${organization}:fixture/api-cancellation` });
  const path = `/scans/${scan._id}/cancel`;
  assert.equal((await request(app).post(path)).status, 401);
  assert.equal((await request(app).post(path).set("X-Fixture-Actor", String(outsider._id))).status, 404);
  assert.equal((await Scan.findById(scan._id)).status, "running");
  assert.equal(await Audit.countDocuments({ target: `scan/${scan._id}`, action: "scan.cancelled" }), 0);
  checks.push("http_cancellation_rejects_signed_out_and_other_organization_accounts");

  const cancelled = await request(app).post(path).set("X-Fixture-Actor", String(actor._id));
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.headers["x-securepatch-audit-recorded"], "true");
  const saved = await Scan.findById(scan._id);
  assert.equal(saved.status, "failed"); assert.ok(saved.cancelledAt);
  assert.equal(saved.activeKey, null); assert.equal(saved.leaseToken, null);
  const event = await Audit.findOne({ target: `scan/${scan._id}`, action: "scan.cancelled" });
  assert.equal(String(event.actor), String(actor._id));
  assert.equal(String(event.organization), String(organization));
  await assert.rejects(persistScanCompletion({ scanId: scan._id, leaseToken: "fixture-api-lease",
    fields: { status: "completed" }, findings: [] }), /cancelled/);
  checks.push("http_cancellation_releases_lock_records_actor_and_blocks_late_completion");

  assert.equal((await request(app).post(path).set("X-Fixture-Actor", String(actor._id))).status, 409);
  assert.equal(await Audit.countDocuments({ target: `scan/${scan._id}`, action: "scan.cancelled" }), 1);
  const completed = await Scan.create({ organization, owner: "fixture", repo: "api-completed", installationId: "123",
    status: "completed", completedAt: new Date() });
  assert.equal((await request(app).post(`/scans/${completed._id}/cancel`).set("X-Fixture-Actor", String(actor._id))).status, 409);
  assert.equal((await Scan.findById(completed._id)).status, "completed");
  checks.push("http_repeated_and_terminal_cancellation_return_conflict_without_rewriting_history");

  const queued = await Scan.create({ organization, owner: "fixture", repo: "api-queued", installationId: "123", status: "queued" });
  assert.equal((await request(app).post(`/scans/${queued._id}/cancel`).set("X-Fixture-Actor", String(actor._id))).status, 200);
  assert.ok((await Scan.findById(queued._id)).cancelledAt);
  checks.push("http_cancellation_also_handles_queued_scans");
  return checks;
}

module.exports = { runCancellationChecks };

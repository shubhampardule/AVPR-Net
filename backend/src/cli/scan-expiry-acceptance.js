// Uses only the disposable database established by the parent acceptance CLI.
const assert = require("node:assert/strict");
const { Types } = require("mongoose");
const Scan = require("../models/Scan");
const { expireOverdueScans, EXPIRY_BATCH_SIZE } = require("../services/scan-expiry.service");

async function runScanExpiryChecks(organization) {
  const checks = [], now = new Date(), otherOrganization = new Types.ObjectId();
  const base = { organization, owner: "Fixture", repo: "Expiry", installationId: "123", status: "running",
    leaseToken: "fixture-expiry", deadlineAt: new Date(now.getTime() - 1000) };
  const activeKey = `${organization}:fixture/expiry`;
  const [expired, future, completed, legacy, control] = await Scan.create([
    { ...base, activeKey },
    { ...base, deadlineAt: new Date(now.getTime() + 60000) },
    { ...base, status: "completed" },
    { ...base, deadlineAt: null },
    { ...base, organization: otherOrganization, activeKey: "fixture-control-expiry" },
  ]);
  assert.equal(await expireOverdueScans({ organization, activeKey }, now), 1);
  let result = await Scan.findById(expired._id);
  assert.equal(result.status, "failed"); assert.equal(result.activeKey, null); assert.equal(result.leaseToken, null);
  assert.equal((await Scan.findById(future._id)).status, "running");
  assert.equal((await Scan.findById(completed._id)).status, "completed");
  assert.equal((await Scan.findById(legacy._id)).status, "running");
  assert.equal((await Scan.findById(control._id)).status, "running");
  checks.push("scoped_expiry_releases_case_normalized_lock_without_touching_other_scans");

  // Separate fixture organization avoids interacting with previous acceptance cases.
  const batchOrganization = new Types.ObjectId();
  await Scan.insertMany(Array.from({ length: EXPIRY_BATCH_SIZE + 1 }, (_, index) => ({ ...base,
    organization: batchOrganization, repo: `expiry-${index}`, status: index % 2 ? "queued" : "running" })));
  assert.equal(await expireOverdueScans({ organization: batchOrganization }, now), EXPIRY_BATCH_SIZE);
  assert.equal(await Scan.countDocuments({ organization: batchOrganization, status: { $in: ["queued", "running"] } }), 1);
  assert.equal(await expireOverdueScans({ organization: batchOrganization }, now), 1);
  assert.equal(await Scan.countDocuments({ organization: batchOrganization, status: "failed", leaseToken: null }), EXPIRY_BATCH_SIZE + 1);
  checks.push("overdue_backlog_recovers_in_bounded_idempotent_maintenance_passes");
  assert.equal(await expireOverdueScans({ organization: batchOrganization }, now), 0);
  return checks;
}

module.exports = { runScanExpiryChecks };

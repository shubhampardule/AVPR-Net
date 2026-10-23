// Runs only within lifecycle-acceptance's verified disposable database.
const assert = require("node:assert/strict");
const Scan = require("../models/Scan");
const Finding = require("../models/Finding");
const { persistScanCompletion } = require("../services/scan-completion.service");

async function runScanCompletionChecks(organization) {
  const checks = [];
  const create = extra => Scan.create({ organization, owner: "fixture", repo: "completion", installationId: "123",
    status: "running", leaseToken: "fixture-lease", ...extra });
  const evidence = (scan, fingerprint) => ({ scan: scan._id, organization, owner: "fixture", repo: "completion",
    filePath: "fixture.js", startLine: 1, ruleId: "fixture-rule", scanner: "semgrep", severity: "low",
    title: "Synthetic acceptance finding", fingerprint, riskScore: 1, riskCategory: "low",
    riskFactors: { severity: 1, exploitability: 1, occurrence: 1, businessImpact: 1 } });
  const fields = { status: "completed", completedAt: new Date(), leaseToken: null, leaseUntil: null,
    activeKey: null, summary: { total: 1, low: 1 } };

  let scan = await create();
  await persistScanCompletion({ scanId: scan._id, leaseToken: "fixture-lease", fields,
    findings: [evidence(scan, "fixture-success")] });
  assert.equal((await Scan.findById(scan._id)).status, "completed");
  assert.equal(await Finding.countDocuments({ scan: scan._id }), 1);
  checks.push("completion_commits_scan_and_findings_together");

  scan = await create({ status: "failed", cancelledAt: new Date(), leaseToken: null });
  await assert.rejects(persistScanCompletion({ scanId: scan._id, leaseToken: "fixture-lease", fields,
    findings: [evidence(scan, "fixture-cancelled")] }), /cancelled/);
  assert.equal((await Scan.findById(scan._id)).status, "failed");
  assert.equal(await Finding.countDocuments({ scan: scan._id }), 0);
  checks.push("cancelled_scan_rejects_completion_and_evidence_insertion");

  scan = await create({ leaseToken: "replacement-lease" });
  await assert.rejects(persistScanCompletion({ scanId: scan._id, leaseToken: "fixture-lease", fields,
    findings: [evidence(scan, "fixture-stale")] }), /replaced/);
  assert.equal((await Scan.findById(scan._id)).leaseToken, "replacement-lease");
  assert.equal(await Finding.countDocuments({ scan: scan._id }), 0);
  checks.push("reclaimed_scan_rejects_original_workers_findings");

  scan = await create({ deadlineAt: new Date(Date.now() - 1000) });
  await assert.rejects(persistScanCompletion({ scanId: scan._id, leaseToken: "fixture-lease", fields,
    findings: [evidence(scan, "fixture-expired")] }), /expired/);
  assert.equal((await Scan.findById(scan._id)).status, "running");
  assert.equal(await Finding.countDocuments({ scan: scan._id }), 0);
  checks.push("expired_scan_rejects_completion_even_before_maintenance_runs");

  scan = await create();
  const sentinel = await Finding.create(evidence(scan, "fixture-sentinel"));
  // Force a real duplicate-_id error after another operation in the same batch;
  // no database failpoint, validator alteration, or production data is involved.
  await assert.rejects(persistScanCompletion({ scanId: scan._id, leaseToken: "fixture-lease", fields,
    findings: [evidence(scan, "fixture-must-roll-back"),
      { ...evidence(scan, "fixture-conflict"), _id: sentinel._id }] }), error => error.code === 11000);
  const unchanged = await Scan.findById(scan._id);
  assert.equal(unchanged.status, "running"); assert.equal(unchanged.leaseToken, "fixture-lease");
  assert.equal(unchanged.completedAt, null);
  assert.equal(await Finding.countDocuments({ scan: scan._id }), 1);
  assert.equal(await Finding.countDocuments({ scan: scan._id, fingerprint: "fixture-must-roll-back" }), 0);
  checks.push("finding_write_failure_rolls_back_completion_and_entire_evidence_batch");
  return checks;
}

module.exports = { runScanCompletionChecks };

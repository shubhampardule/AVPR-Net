const crypto = require("node:crypto");
const RemediationVerification = require("../models/RemediationVerification");

const DIGEST = value => crypto.createHash("sha256").update(value, "utf8").digest("hex");

function checkRecord(validation) {
  const syntaxStatus = ["passed", "failed", "skipped", "unavailable"].includes(validation.syntax?.status)
    ? validation.syntax.status : "unavailable";
  const syntaxDetail = syntaxStatus === "passed" ? "parser_passed"
    : syntaxStatus === "failed" ? "syntax_check_failed"
      : syntaxStatus === "skipped" ? "syntax_check_skipped" : "parser_unavailable";
  return [
    { name: "patch_integrity", status: "passed", method: "strict-single-file-diff", detailCode: "exact_source_context" },
    { name: "syntax", status: syntaxStatus, method: validation.syntax?.method || null, detailCode: syntaxDetail },
    { name: "allowed_tests", status: "unavailable", method: null, detailCode: "isolated_runner_unavailable" },
    validation.securityRescan?.status==="passed"
      ? {name:"security_rescan",status:"passed",method:"paired-pinned-snapshot",detailCode:"target_alert_absent_no_new_counts"}
      : { name: "security_rescan", status: "unavailable", method: null, detailCode: "proposal_branch_scan_unavailable" },
  ];
}

function pullRequestRecord(pullRequest) {
  if (!pullRequest) return undefined;
  let url = null;
  try {
    const parsed = new URL(pullRequest.url);
    if (parsed.protocol === "https:" && parsed.hostname === "github.com" && /^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/\d+\/?$/.test(parsed.pathname)) url = parsed.toString();
  } catch { /* An invalid link is omitted from the record. */ }
  return {
    number: Number.isSafeInteger(pullRequest.number) && pullRequest.number > 0 ? pullRequest.number : null,
    url,
    branch: typeof pullRequest.branch === "string" ? pullRequest.branch.slice(0, 200) : null,
    baseSha: /^[a-f0-9]{40}$/i.test(pullRequest.baseSha || "") ? pullRequest.baseSha : null,
  };
}

async function recordVerification({ scan, finding, actorId, patch, validation, action, pullRequest }) {
  if (!scan?.commitSha || typeof validation?.context?.originalCode !== "string" || typeof validation.content !== "string" || typeof patch !== "string") {
    throw new Error("Cannot record remediation verification without exact source and proposed content");
  }
  return RemediationVerification.create({
    organization: scan.organization,
    scan: scan._id,
    finding: finding._id,
    requestedBy: actorId,
    repository: `${scan.owner}/${scan.repo}`.slice(0, 140),
    sourceCommitSha: scan.commitSha,
    targetPath: validation.context.filePath,
    patchSha256: DIGEST(patch),
    sourceSha256: DIGEST(validation.context.originalCode),
    proposedSha256: DIGEST(validation.content),
    action,
    checks: checkRecord(validation),
    ...(validation.securityRescan?.status==="passed"?{securityRescan:{jobId:validation.securityRescan.jobId,
      rulesHash:validation.securityRescan.rulesHash,policyHash:validation.securityRescan.policyHash}}:{}),
    pullRequest: pullRequestRecord(pullRequest),
  });
}

async function recordFailedIntegrity({ scan, finding, actorId, patch, context }) {
  if (!scan?.commitSha || typeof context?.originalCode !== "string" || typeof patch !== "string") {
    throw new Error("Cannot record patch-integrity failure without exact source context");
  }
  return RemediationVerification.create({
    organization: scan.organization,
    scan: scan._id,
    finding: finding._id,
    requestedBy: actorId,
    repository: `${scan.owner}/${scan.repo}`.slice(0, 140),
    sourceCommitSha: scan.commitSha,
    targetPath: context.filePath,
    patchSha256: DIGEST(patch),
    sourceSha256: DIGEST(context.originalCode),
    proposedSha256: null,
    action: "validation",
    checks: [
      { name: "patch_integrity", status: "failed", method: "strict-single-file-diff", detailCode: "diff_not_applicable" },
      { name: "syntax", status: "skipped", method: null, detailCode: "patch_integrity_failed" },
      { name: "allowed_tests", status: "unavailable", method: null, detailCode: "isolated_runner_unavailable" },
      { name: "security_rescan", status: "unavailable", method: null, detailCode: "proposal_branch_scan_unavailable" },
    ],
  });
}

async function listVerifications({ organizationId, scanId, findingId, limit = 20 }) {
  return RemediationVerification.find({ organization: organizationId, scan: scanId, finding: findingId })
    .sort({ createdAt: -1, _id: -1 }).limit(Math.min(Math.max(limit, 1), 50)).lean();
}

module.exports = { recordVerification, recordFailedIntegrity, listVerifications, checkRecord, pullRequestRecord };

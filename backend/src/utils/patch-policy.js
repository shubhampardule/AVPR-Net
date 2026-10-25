const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");

function computePolicyHash(sourceRoot) {
  if (!sourceRoot) throw Object.assign(new Error("Scanner policy sources unavailable"), { code: "RESCAN_POLICY_UNAVAILABLE" });
  const hash = createHash("sha256");
  for (const file of ["services/patch-rescan.service.js", "services/normalizer.service.js", "scanners/orchestrator.js", "scanners/process.js",
    "scanners/semgrep.adapter.js", "scanners/bandit.adapter.js", "scanners/repository-data.adapter.js", "scanners/rules.yml",
    "utils/scanner-rule.js", "utils/exact-patch.js", "utils/review-source.js", "services/code-validation.js", "utils/patch-policy.js"]) {
    hash.update(file).update("\0").update(fs.readFileSync(path.join(sourceRoot, file), "utf8").replace(/\r\n/g, "\n")).update("\0");
  }
  return hash.digest("hex");
}
module.exports = { computePolicyHash };

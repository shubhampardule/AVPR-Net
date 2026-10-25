const path = require("node:path");

const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".py"]);

function supportsRemediation(finding) {
  if (!finding || typeof finding.filePath !== "string") return false;
  const scanner = String(finding.scanner || "").toLowerCase();
  const extension = path.posix.extname(finding.filePath).toLowerCase();
  if (!SOURCE_EXTENSIONS.has(extension)) return false;
  // Secret matches must never send the matched file to hosted inference. Dependency
  // and artifact findings need coordinated manifest/lockfile changes, which the
  // current single-file patch and rescan contract cannot verify.
  if (scanner === "secrets" || scanner === "dependency" || scanner === "trivy") return false;
  if (scanner === "bandit") return extension === ".py";
  return scanner === "semgrep";
}

module.exports = { supportsRemediation, SOURCE_EXTENSIONS };

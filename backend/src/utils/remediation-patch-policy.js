const { canonicalRule } = require("./scanner-rule");

function validateRemediationPatch(finding, content) {
  const scanner = String(finding?.scanner || "").toLowerCase();
  const rule = scanner === "semgrep" ? canonicalRule(finding?.ruleId) : String(finding?.ruleId || "");

  // 1. SQL Identifier validation (Bandit B608 and Semgrep SQL concatenation/formatting)
  if ((scanner === "bandit" && rule === "B608") ||
      (scanner === "semgrep" && ["securepatch.js.sql-concatenation", "securepatch.python.sql-formatting"].includes(rule))) {
    const identifierPlaceholder = String.raw`(?:\?|%s|:[A-Za-z_]\w*|\$\d+|%\([A-Za-z_]\w*\)s)`;
    const identifierClause = new RegExp(
      "\\b(?:FROM|JOIN|INTO|UPDATE|TABLE|ORDER\\s+BY|GROUP\\s+BY)\\s+[\\\"'`]?\\s*" +
        identifierPlaceholder + "\\s*[\\\"'`]?",
      "i",
    );
    if (identifierClause.test(content)) {
      throw Object.assign(new Error("SQL value placeholders cannot stand for table or column names. Keep identifiers fixed or allowlisted, and bind only data values."), {
        code: "REMEDIATION_SQL_IDENTIFIER_BOUND_AS_VALUE",
        statusCode: 422,
      });
    }
  }

  // 2. Command execution validation (shell flag must not be true)
  if ((scanner === "bandit" && ["B602", "B605"].includes(rule)) ||
      (scanner === "semgrep" && ["securepatch.js.shell-exec", "securepatch.python.shell"].includes(rule))) {
    if (/\bshell\s*=\s*True\b/.test(content) || /\bshell\s*:\s*true\b/.test(content)) {
      throw Object.assign(new Error("Command execution must disable shell mode (use shell=False or execFile with an argument array) to prevent injection."), {
        code: "REMEDIATION_SHELL_FLAG_ENABLED",
        statusCode: 422,
      });
    }
  }

  // 3. Weak cryptographic hashing validation
  if ((scanner === "bandit" && ["B303", "B324"].includes(rule)) ||
      (scanner === "semgrep" && rule === "securepatch.js.weak-hash")) {
    if (/crypto\.createHash\(\s*["'](?:md5|sha1)["']\s*\)/i.test(content) ||
        /hashlib\.(?:md5|sha1)\s*\(/i.test(content)) {
      throw Object.assign(new Error("Remediation must use modern collision-resistant hashes such as SHA-256 instead of MD5 or SHA-1."), {
        code: "REMEDIATION_WEAK_HASH_RETAINED",
        statusCode: 422,
      });
    }
  }

  // 4. Insecure YAML loading validation
  if ((scanner === "bandit" && rule === "B506") ||
      (scanner === "semgrep" && rule === "securepatch.python.insecure-yaml")) {
    if (/yaml\.(?:load|unsafe_load)\s*\(.*Loader\s*=\s*yaml\.(?:UnsafeLoader|Loader)\s*\)/i.test(content)) {
      throw Object.assign(new Error("YAML documents must be parsed using yaml.safe_load to avoid arbitrary object instantiation."), {
        code: "REMEDIATION_INSECURE_YAML_LOADER",
        statusCode: 422,
      });
    }
  }
}

module.exports = { validateRemediationPatch };

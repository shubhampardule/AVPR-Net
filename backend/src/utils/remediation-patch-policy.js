const { canonicalRule } = require("./scanner-rule");

function validateRemediationPatch(finding, content) {
  const scanner = String(finding?.scanner || "").toLowerCase();
  const rule = scanner === "semgrep" ? canonicalRule(finding?.ruleId) : String(finding?.ruleId || "");
  if (scanner !== "bandit" || rule !== "B608") return;

  // Placeholders bind data values, never SQL identifiers. Reject common driver
  // placeholder styles in identifier positions before a proposal is presented
  // and repeat this check in the isolated rescan worker.
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

module.exports = { validateRemediationPatch };

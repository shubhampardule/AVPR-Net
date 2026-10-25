const { validateRemediationPatch } = require("../src/utils/remediation-patch-policy");

test.each([
  ["SELECT ? FROM ?", "sqlite"],
  ["SELECT id FROM :table_name", "named"],
  ["SELECT id FROM $1", "postgres"],
  ["SELECT id FROM %(table)s", "pyformat"],
  ["SELECT id FROM %s", "format"],
])("rejects value placeholders in SQL identifier positions (%s)", query => {
  expect(() => validateRemediationPatch({ scanner: "bandit", ruleId: "B608" }, `connection.execute("${query}")`))
    .toThrow(/cannot stand for table or column names/i);
});

test("allows value placeholders while identifiers remain fixed", () => {
  expect(() => validateRemediationPatch({ scanner: "bandit", ruleId: "B608" },
    'connection.execute("SELECT * FROM users WHERE email = ?", (email,))')).not.toThrow();
});

test("does not apply the SQL guard to unrelated scanner rules", () => {
  expect(() => validateRemediationPatch({ scanner: "bandit", ruleId: "B605" }, 'run("SELECT * FROM ?")')).not.toThrow();
});

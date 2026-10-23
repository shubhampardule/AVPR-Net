const { forFinding, GUIDANCE_VERSION } = require("../src/services/remediation-guidance.service");

const rules = [
  "securepatch.js.dynamic-eval", "securepatch.js.shell-exec", "securepatch.js.raw-html", "securepatch.js.weak-hash",
  "securepatch.js.sql-concatenation", "securepatch.js.disabled-tls", "securepatch.js.jwt-unverified",
  "securepatch.python.pickle", "securepatch.python.dynamic-eval", "securepatch.python.shell",
  "securepatch.python.sql-formatting", "securepatch.python.insecure-yaml",
];
test("host-prefixed Semgrep rules still receive the fixed project guidance",()=>{
 expect(forFinding({scanner:"semgrep",ruleId:"mnt.machine.backend.securepatch.js.sql-concatenation"}).title).toBe("Bind SQL parameters");
});
test.each(rules)("returns versioned fixed guidance for project-owned rule %s", ruleId => {
  const result = forFinding({ scanner: "semgrep", ruleId });
  expect(result).toMatchObject({ source: "deterministic", version: GUIDANCE_VERSION });
  expect(result.title.length).toBeGreaterThan(0);
  expect(result.summary.length).toBeGreaterThan(0);
  expect(result.steps.length).toBeGreaterThan(0);
});
test.each(["B301", "B602", "B605", "B506", "B608", "B303", "B324"])("supports common Bandit rule %s", ruleId => {
  expect(forFinding({ scanner: "bandit", ruleId })?.source).toBe("deterministic");
});
test.each(["github-token", "nvidia-token", "aws-access-id", "private-key"])("supports local secret pattern %s", ruleId => {
  expect(forFinding({ scanner: "secrets", ruleId })?.source).toBe("deterministic");
});
test("uses bounded generic guidance for dependency advisories and leaves unknown rules unmapped", () => {
  expect(forFinding({ scanner: "dependency", ruleId: "GHSA-test:pkg@1.0.0" })).toMatchObject({ source: "deterministic", version: GUIDANCE_VERSION });
  expect(forFinding({ scanner: "semgrep", ruleId: "unreviewed-rule" })).toBeNull();
  expect(forFinding({ scanner: "nemotron", ruleId: "suggested-fix" })).toBeNull();
});

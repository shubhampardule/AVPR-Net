jest.mock("../src/config/github", () => require("./__mocks__/github"));
jest.mock("../src/models/Scan", () => ({ findById: jest.fn(), find: jest.fn() }));
jest.mock("../src/models/Finding", () => ({ find: jest.fn(), countDocuments: jest.fn() }));
jest.mock("../src/queues/scanQueue", () => ({ scanQueue: {} }));
const ScanService = require("../src/services/scan.service");
const Finding = require("../src/models/Finding");
const Deduplicator = require("../src/services/deduplicator.service");
const Orchestrator = require("../src/scanners/orchestrator");
const { applyExactDiff } = require("../src/services/remediation.service");
const { createTwoFilesPatch } = require("diff");

test.each(["0", "-1", "NaN", "101", "1.1", ["1"], {}])("findings reject invalid limits %j before querying", async limit => {
  await expect(ScanService.getScanFindings("scan", { limit })).rejects.toMatchObject({ statusCode: 400 });
  expect(Finding.find).not.toHaveBeenCalled();
});
test("case-sensitive source files remain distinct", () => {
  const findings = ["src/Auth.js", "src/auth.js"].map(filePath => ({ filePath, cwe: "CWE-79", ruleId: "rule", startLine: 1, severity: "high" }));
  expect(Deduplicator.deduplicate("owner", "repo", findings)).toHaveLength(2);
});
test("risk heuristics match exact CWE IDs and recognize test-only paths first", () => {
  const Risk = require("../src/services/risk.service");
  expect(Risk.getExploitabilityScore("CWE-787: Out-of-bounds Write")).toBe(4.5);
  expect(Risk.getExploitabilityScore("CWE-78: OS Command Injection")).toBe(9);
  expect(Risk.getBusinessImpactScore("tests/auth.test.js")).toBe(2);
});
test("all scanner failures reject rather than returning a clean result", async () => {
  const scanner = { name: "test", isAvailable: async () => true, scan: async () => { throw new Error("failed"); } };
  await expect(new Orchestrator([scanner]).runAll("synthetic")).rejects.toMatchObject({ code: "ALL_SCANNERS_FAILED" });
});
test("diff applies only to its selected file and exact source", () => {
  const patch = createTwoFilesPatch("a/src/test.js", "b/src/test.js", "const x = 1;\n", "const x = 2;\n");
  expect(applyExactDiff("const x = 1;\n", patch, "src/test.js")).toBe("const x = 2;\n");
  expect(() => applyExactDiff("const x = 99;\n", patch, "src/test.js")).toThrow();
  expect(() => applyExactDiff("const x = 1;\n", patch, "other.js")).toThrow();
  expect(() => applyExactDiff("const x = 1;\n", patch + patch, "src/test.js")).toThrow();
});

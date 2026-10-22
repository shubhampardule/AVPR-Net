const { evaluateBenchmark } = require("../src/services/benchmark.service");
const finding = (line = 1) => ({ scanner: "semgrep", ruleId: "example-rule", filePath: "source.js", line });
const data = item => ({ schemaVersion: 1, datasetKind: "synthetic", cases: [{ id: "case-1", language: "javascript", coverageComplete: true, expected: [], observed: [], ...item }] });
test("matches one-to-one, counts duplicate alerts as false positives, and retains missing findings", () => {
  const result = evaluateBenchmark(data({ expected: [finding(1), finding(2)], observed: [finding(1), finding(1), finding(3)] }));
  expect(result.overall).toEqual({ truePositives: 1, falsePositives: 2, falseNegatives: 1, precision: 1 / 3, recall: 1 / 2 });
  expect(result.correlation.duplicateDetections).toBe(1);
  expect(result.provenance).toContain("Synthetic");
});
test("undefined rates stay null instead of implying perfect accuracy", () => {
  expect(evaluateBenchmark(data({})).overall).toMatchObject({ precision: null, recall: null });
});
test("counts incorrect merge and split pairs without confusing group names with issue identities", () => {
  const result = evaluateBenchmark(data({ correlation: [
    { id: "a", expectedIssue: "one", actualGroup: "merged" },
    { id: "b", expectedIssue: "two", actualGroup: "merged" },
    { id: "c", expectedIssue: "one", actualGroup: "separate" },
  ] }));
  expect(result.correlation).toEqual({ duplicateDetections: 0, falseMergePairs: 1, falseSplitPairs: 1 });
});
test("partial scans, duplicate annotations, and missing independent review metadata are rejected", () => {
  expect(() => evaluateBenchmark(data({ coverageComplete: false }))).toThrow(/complete coverage/);
  expect(() => evaluateBenchmark(data({ expected: [finding(), finding()] }))).toThrow(/Duplicate ground/);
  expect(() => evaluateBenchmark({ ...data({}), datasetKind: "reviewed" })).toThrow(/reviewer/);
});
test("rule and language statistics do not collapse distinct evidence", () => {
  const input = data({ expected: [finding()], observed: [finding()] });
  input.cases.push({ ...input.cases[0], id: "case-2", language: "typescript", observed: [] });
  expect(evaluateBenchmark(input).byRule).toHaveLength(2);
});

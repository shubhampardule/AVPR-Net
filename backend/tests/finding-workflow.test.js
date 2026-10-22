jest.mock("../src/models/Scan", () => ({ findById: jest.fn(), findOne: jest.fn() }));
jest.mock("../src/models/Finding", () => ({ find: jest.fn() }));
const Scan = require("../src/models/Scan"), Finding = require("../src/models/Finding");
const { compare, exportScan } = require("../src/services/finding-workflow.service");
const coverage = [{ scanner: "semgrep", version: "1", scanned: 10, skipped: null, filesHash: "same-files" }];
const scan = { _id: "current", organization: "org", owner: "owner", repo: "repo", status: "completed", createdAt: new Date(), commitSha: "a".repeat(40), scannersUsed: ["semgrep"], scannerErrors: [], rulesHash: "rules", scannerPolicyHash: "scanner-policy-v1", normalizerHash: "normalizer-v1", coverage };
const chain = data => ({ sort() { return this; }, limit() { return this; }, lean: async () => data });
async function comparisonWith(previous, currentFindings = [], previousFindings = []) {
  Scan.findById.mockReturnValue({ lean: async () => scan });
  Scan.findOne.mockReturnValue(chain(previous));
  Finding.find.mockReturnValueOnce(chain(currentFindings)).mockReturnValueOnce(chain(previousFindings));
  return compare("current");
}
beforeEach(() => jest.resetAllMocks());
test("comparison identifies fixed issues only with matching successful coverage", async () => {
  const result = await comparisonWith({ ...scan, _id: "previous" }, [{ fingerprint: "same" }, { fingerprint: "new" }], [{ fingerprint: "same" }, { fingerprint: "fixed" }]);
  expect(result.canCompare).toBe(true); expect(result.canInferFixed).toBe(true);
  expect(result.fixed).toHaveLength(1); expect(result.new).toHaveLength(1); expect(result.persistent).toHaveLength(1);
});
test("a partial scan cannot report missing issues as fixed", async () => {
  Scan.findById.mockReturnValue({ lean: async () => ({ ...scan, scannerErrors: [{ scanner: "bandit" }] }) });
  Scan.findOne.mockReturnValue(chain({ ...scan, _id: "previous" }));
  Finding.find.mockReturnValueOnce(chain([])).mockReturnValueOnce(chain([{ fingerprint: "old" }]));
  const result = await compare("current");
  expect(result.canCompare).toBe(false); expect(result.canInferFixed).toBe(false);
  expect(result.new).toEqual([]); expect(result.persistent).toEqual([]); expect(result.fixed).toEqual([]);
});
test("a changed normalization policy cannot classify filtered findings as fixed", async () => {
  Scan.findById.mockReturnValue({ lean: async () => scan });
  Scan.findOne.mockReturnValue(chain({ ...scan, _id: "previous", normalizerHash: "normalizer-v0" }));
  Finding.find.mockReturnValueOnce(chain([])).mockReturnValueOnce(chain([{ fingerprint: "filtered-by-new-policy" }]));
  const result = await compare("current");
  expect(result.canInferFixed).toBe(false);
  expect(result.new).toEqual([]); expect(result.persistent).toEqual([]); expect(result.fixed).toEqual([]);
});
test.each([
  ["scanner version", { coverage: [{ ...coverage[0], version: "2" }] }],
  ["covered file set", { coverage: [{ ...coverage[0], filesHash: "different-files" }] }],
  ["scanner set", { scannersUsed: ["semgrep", "bandit"], coverage: [{ ...coverage[0] }, { scanner: "bandit", version: "1", filesHash: "same-files" }] }],
  ["rule set", { rulesHash: "new-rules" }],
  ["scanner implementation", { scannerPolicyHash: "new-scanner-policy" }],
])("does not assign change labels when %s differs", async (_name, change) => {
  const result = await comparisonWith({ ...scan, _id: "previous", ...change }, [{ fingerprint: "appeared" }], [{ fingerprint: "disappeared" }]);
  expect(result.canCompare).toBe(false);
  expect(result.new).toEqual([]); expect(result.persistent).toEqual([]); expect(result.fixed).toEqual([]);
  expect(result.limitation).toMatch(/not classified|not classif/i);
});
test("does not label findings new when there is no previous successful scan", async () => {
  const result = await comparisonWith(null, [{ fingerprint: "first-scan" }]);
  expect(result).toMatchObject({ canCompare: false, previousScanId: null, new: [], persistent: [], fixed: [] });
  expect(result.limitation).toMatch(/No earlier completed scan/);
});
test("SARIF retains exact source provenance and scanner risk separately", async () => {
  Scan.findById.mockReturnValue({ lean: async () => scan });
  Finding.find.mockReturnValue(chain([{ ruleId: "test", severity: "high", title: "Test", filePath: "src/a file.js", startLine: 2, riskScore: 5, riskCategory: "medium", fingerprint: "id" }]));
  const report = await exportScan("current", "sarif");
  expect(report.version).toBe("2.1.0"); expect(report.runs[0].properties.commitSha).toBe(scan.commitSha);
  expect(report.runs[0].results[0]).toMatchObject({ level: "error", properties: { riskScore: 5, riskCategory: "medium" } });
  expect(report.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri).toBe("src/a%20file.js");
});

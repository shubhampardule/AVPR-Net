jest.mock("../src/models/Scan", () => ({ findById: jest.fn(), findOne: jest.fn() }));
jest.mock("../src/models/Finding", () => ({ find: jest.fn() }));
const Scan = require("../src/models/Scan"), Finding = require("../src/models/Finding");
const { compare, exportScan } = require("../src/services/finding-workflow.service");
const coverage = [{ scanner: "semgrep", version: "1", scanned: 10, skipped: null, filesHash: "same-files" }];
const scan = { _id: "current", organization: "org", owner: "owner", repo: "repo", status: "completed", createdAt: new Date(), commitSha: "a".repeat(40), scannersUsed: ["semgrep"], scannerErrors: [], rulesHash: "rules", normalizerHash: "normalizer-v1", coverage };
const chain = data => ({ sort() { return this; }, limit() { return this; }, lean: async () => data });
beforeEach(() => jest.resetAllMocks());
test("comparison identifies fixed issues only with matching successful coverage", async () => {
  Scan.findById.mockReturnValue({ lean: async () => scan });
  Scan.findOne.mockReturnValue(chain({ ...scan, _id: "previous" }));
  Finding.find.mockReturnValueOnce(chain([{ fingerprint: "same" }, { fingerprint: "new" }]))
    .mockReturnValueOnce(chain([{ fingerprint: "same" }, { fingerprint: "fixed" }]));
  const result = await compare("current");
  expect(result.canInferFixed).toBe(true); expect(result.fixed).toHaveLength(1); expect(result.new).toHaveLength(1); expect(result.persistent).toHaveLength(1);
});
test("a partial scan cannot report missing issues as fixed", async () => {
  Scan.findById.mockReturnValue({ lean: async () => ({ ...scan, scannerErrors: [{ scanner: "bandit" }] }) });
  Scan.findOne.mockReturnValue(chain({ ...scan, _id: "previous" }));
  Finding.find.mockReturnValueOnce(chain([])).mockReturnValueOnce(chain([{ fingerprint: "old" }]));
  const result = await compare("current"); expect(result.canInferFixed).toBe(false); expect(result.fixed).toEqual([]);
});
test("a changed normalization policy cannot classify filtered findings as fixed", async () => {
  Scan.findById.mockReturnValue({ lean: async () => scan });
  Scan.findOne.mockReturnValue(chain({ ...scan, _id: "previous", normalizerHash: "normalizer-v0" }));
  Finding.find.mockReturnValueOnce(chain([])).mockReturnValueOnce(chain([{ fingerprint: "filtered-by-new-policy" }]));
  const result = await compare("current");
  expect(result.canInferFixed).toBe(false);
  expect(result.fixed).toEqual([]);
});
test("SARIF retains exact source provenance and scanner risk separately", async () => {
  Scan.findById.mockReturnValue({ lean: async () => scan });
  Finding.find.mockReturnValue(chain([{ ruleId: "test", severity: "high", title: "Test", filePath: "src/a file.js", startLine: 2, riskScore: 5, riskCategory: "medium", fingerprint: "id" }]));
  const report = await exportScan("current", "sarif");
  expect(report.version).toBe("2.1.0"); expect(report.runs[0].properties.commitSha).toBe(scan.commitSha);
  expect(report.runs[0].results[0]).toMatchObject({ level: "error", properties: { riskScore: 5, riskCategory: "medium" } });
  expect(report.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri).toBe("src/a%20file.js");
});

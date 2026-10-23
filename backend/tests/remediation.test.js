jest.mock("../src/services/github.service", () => ({ getFileContent: jest.fn(), resolveCommit: jest.fn() }));
jest.mock("../src/config/github", () => ({ getInstallationOctokit: jest.fn(), githubApp: { octokit: { request: jest.fn() } } }));
const { getFileContent } = require("../src/services/github.service");
const { source } = require("../src/services/remediation.service");

beforeEach(() => jest.resetAllMocks());
test("model requests contain canonical rule guidance without exposing host prefixes",async()=>{
 getFileContent.mockResolvedValue({content:"export const value = 1;\n"});
 const context=await source({_id:"scan-1",commitSha:"a".repeat(40),installationId:"42",owner:"org",repo:"repo"},
  {_id:"finding-1",filePath:"code.js",scanner:"semgrep",ruleId:"mnt.private-machine.securepatch.js.sql-concatenation",title:"SQL"});
 expect(context.request).toContain("parameterized query API");expect(context.request).not.toContain("private-machine");
 expect(context.request).toContain("do not add scanner suppressions");
});

test("remediation context loads only the finding file at its immutable scan commit", async () => {
  getFileContent.mockResolvedValue({ content: "export const value = 1;\n" });
  const scan = { _id: "scan-1", commitSha: "a".repeat(40), installationId: "42", owner: "org", repo: "repo" };
  const finding = { _id: "finding-1", filePath: "src/main file.js", ruleId: "securepatch.js.dynamic-eval", title: "Dynamic evaluation" };
  const context = await source(scan, finding);
  expect(getFileContent).toHaveBeenCalledWith("42", "org", "repo", "src/main file.js", scan.commitSha);
  expect(context).toMatchObject({ scanId: "scan-1", findingId: "finding-1", commitSha: scan.commitSha,
    filePath: finding.filePath, originalCode: "export const value = 1;\n" });
  expect(context.request).toContain("unified diff for a/src/main file.js and b/src/main file.js");
});

test("remediation context fails closed when the scan is not pinned or the source is over its limit", async () => {
  await expect(source({ commitSha: null }, { filePath: "src/main.js" })).rejects.toMatchObject({ statusCode: 409 });
  getFileContent.mockResolvedValue({ content: "x".repeat(8001) });
  await expect(source({ commitSha: "a".repeat(40), installationId: "42", owner: "org", repo: "repo" }, { filePath: "src/main.js" }))
    .rejects.toMatchObject({ statusCode: 413 });
});

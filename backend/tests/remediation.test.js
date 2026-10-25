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

test("remediation context fails closed when the scan is not pinned or an affected line exceeds its limit", async () => {
  await expect(source({ commitSha: null }, { filePath: "src/main.js" })).rejects.toMatchObject({ statusCode: 409 });
  getFileContent.mockResolvedValue({ content: "x".repeat(8001) });
  await expect(source({ commitSha: "a".repeat(40), installationId: "42", owner: "org", repo: "repo" }, { filePath: "src/main.js", startLine: 1 }))
    .rejects.toMatchObject({ statusCode: 413 });
});

test("large files expose an exact bounded excerpt while validation preserves the whole file", async () => {
  const original = Array.from({ length: 1468 }, (_, i) => `const value${i} = ${i};\n`).join("");
  getFileContent.mockResolvedValue({ content: original });
  const scan = { _id: "scan-1", commitSha: "a".repeat(40), installationId: "42", owner: "org", repo: "repo" };
  const finding = { _id: "finding-1", filePath: "large.js", startLine: 700, ruleId: "test", title: "test" };
  const context = await source(scan, finding);
  expect(context.originalCode.length).toBeLessThanOrEqual(4000);
  expect(context.sourceWindow.startLine).toBeLessThanOrEqual(700);
  expect(context.sourceWindow.endLine).toBeGreaterThanOrEqual(700);
  expect(context.originalCode).toBe(original.split(/(?<=\n)/).slice(context.sourceWindow.startLine - 1, context.sourceWindow.endLine).join(""));
  const changed = original.replace("const value699 = 699;", "const value699 = 700;");
  const patch = require("diff").createTwoFilesPatch("a/large.js", "b/large.js", original, changed);
  const validated = await require("../src/services/remediation.service").validate(scan, finding, patch);
  expect(validated.context.originalCode).toBe(original);
  expect(validated.content).toBe(changed);
  expect(validated.syntax.status).toBe("passed");
});

test("source failures distinguish missing scans, GitHub access, and unavailable source lines", async () => {
  await expect(source(null, {})).rejects.toMatchObject({ statusCode: 404, code: "SOURCE_NOT_FOUND" });
  const scan = { commitSha: "a".repeat(40), installationId: "42", owner: "org", repo: "repo" };
  const finding = { filePath: "src/main.js", startLine: 9999 };
  getFileContent.mockRejectedValueOnce({ status: 403, message: "private GitHub response" });
  await expect(source(scan, finding)).rejects.toMatchObject({ statusCode: 403, code: "SOURCE_ACCESS_DENIED" });
  getFileContent.mockResolvedValue({ content: "const value = 1;\n".repeat(1000) });
  await expect(source(scan, finding)).rejects.toMatchObject({ statusCode: 409, code: "SOURCE_LINE_UNAVAILABLE" });
});

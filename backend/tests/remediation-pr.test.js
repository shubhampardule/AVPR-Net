jest.mock("../src/services/github.service", () => ({
  getFileContent: jest.fn(),
  resolveCommit: jest.fn(),
}));
jest.mock("../src/config/github", () => ({
  getInstallationOctokit: jest.fn(),
  githubApp: { octokit: { request: jest.fn() } },
}));
jest.mock("../src/services/code-validation", () => ({
  validateCode: jest.fn(async () => ({ status: "passed", method: "babel-parser", executed: false })),
}));
jest.mock("../src/services/budget.service", () => ({ consume: jest.fn(async () => {}) }));
jest.mock("../src/services/patch-rescan-jobs.service",()=>({requirePassed:jest.fn(async()=>({status:"passed",jobId:"rescan-job-1"}))}));

const { getFileContent, resolveCommit } = require("../src/services/github.service");
const { getInstallationOctokit, githubApp } = require("../src/config/github");
const budget = require("../src/services/budget.service");
const { createPullRequest } = require("../src/services/remediation.service");

const scan = {
  _id: "scan-1", organization: "org-1", commitSha: "a".repeat(40),
  installationId: "42", owner: "team", repo: "project",
};
const finding = {
  _id: "finding-1", scanner: "semgrep", filePath: "src/index.js", ruleId: "securepatch.js.dynamic-eval",
  title: "Dynamic evaluation", severity: "high", riskScore: 8,
};
const patch = [
  "diff --git a/src/index.js b/src/index.js",
  "index 1111111..2222222 100644",
  "--- a/src/index.js",
  "+++ b/src/index.js",
  "@@ -1 +1 @@",
  "-export const value = 1;",
  "+export const value = 2;",
  "",
].join("\n");

function setup({ pullRequestFailure = null, tree = [{ path: finding.filePath, mode: "100644" }], truncated = false } = {}) {
  getFileContent.mockResolvedValue({ content: "export const value = 1;\n" });
  resolveCommit.mockResolvedValue({ sha: scan.commitSha, branch: "main" });
  githubApp.octokit.request.mockResolvedValue({ data: { permissions: { contents: "write", pull_requests: "write" } } });
  const client = { request: jest.fn(async (route, params) => {
    if (route === "GET /repos/{owner}/{repo}/git/commits/{commit_sha}") return { data: { tree: { sha: "base-tree" } } };
    if (route === "GET /repos/{owner}/{repo}/git/trees/{tree_sha}") return { data: { truncated, tree } };
    if (route === "POST /repos/{owner}/{repo}/git/trees") return { data: { sha: "proposal-tree" } };
    if (route === "POST /repos/{owner}/{repo}/git/commits") return { data: { sha: "proposal-commit" } };
    if (route === "POST /repos/{owner}/{repo}/pulls") {
      if (pullRequestFailure) throw pullRequestFailure;
      return { data: { html_url: "https://github.com/team/project/pull/12", number: 12 } };
    }
    return { data: {} };
  }) };
  getInstallationOctokit.mockResolvedValue(client);
  return client;
}

beforeEach(() => jest.clearAllMocks());

test("creates a reviewed draft PR from the pinned source on a new branch without moving the default branch", async () => {
  const client = setup();

  const result = await createPullRequest(scan, finding, { patch, acknowledged: true });

  expect(result).toMatchObject({ number: 12, draft: true, baseSha: scan.commitSha,
    syntax: { status: "passed", executed: false }, tests: "not_executed" });
  expect(getFileContent).toHaveBeenCalledWith("42", "team", "project", finding.filePath, scan.commitSha);
  expect(resolveCommit).toHaveBeenCalledTimes(2);
  expect(resolveCommit).toHaveBeenNthCalledWith(2, "42", "team", "project");
  expect(budget.consume).toHaveBeenCalledWith("pr:org-1", 10, 3600000);

  const calls = client.request.mock.calls;
  const createCommit = calls.find(([route]) => route === "POST /repos/{owner}/{repo}/git/commits");
  const createRef = calls.find(([route]) => route === "POST /repos/{owner}/{repo}/git/refs");
  const createPr = calls.find(([route]) => route === "POST /repos/{owner}/{repo}/pulls");
  expect(createCommit[1]).toMatchObject({ parents: [scan.commitSha] });
  expect(createRef[1]).toMatchObject({ ref: expect.stringMatching(/^refs\/heads\/securepatch\/fix-finding-1-/), sha: "proposal-commit" });
  expect(createPr[1]).toMatchObject({ head: createRef[1].ref.replace("refs/heads/", ""), base: "main", draft: true });
  expect(calls.some(([route]) => /PATCH .*git\/refs|PUT .*git\/refs/.test(route))).toBe(false);
});

test("refuses to create a proposal unless the user explicitly acknowledges review and unexecuted tests", async () => {
  setup();

  await expect(createPullRequest(scan, finding, { patch, acknowledged: false }))
    .rejects.toMatchObject({ statusCode: 400 });

  expect(getFileContent).not.toHaveBeenCalled();
  expect(resolveCommit).not.toHaveBeenCalled();
  expect(getInstallationOctokit).not.toHaveBeenCalled();
});

test("refuses all GitHub writes when the default branch no longer matches the scanned commit", async () => {
  const client = setup();
  resolveCommit.mockResolvedValue({ sha: "b".repeat(40), branch: "main" });

  await expect(createPullRequest(scan, finding, { patch, acknowledged: true }))
    .rejects.toMatchObject({ statusCode: 409, code: "BASE_CHANGED" });

  expect(getInstallationOctokit).not.toHaveBeenCalled();
  expect(client.request).not.toHaveBeenCalled();
});

test("rechecks the default branch after creating the proposal ref and cleans up if it moved", async () => {
  const client = setup();
  resolveCommit.mockResolvedValueOnce({ sha: scan.commitSha, branch: "main" })
    .mockResolvedValueOnce({ sha: "b".repeat(40), branch: "main" });

  await expect(createPullRequest(scan, finding, { patch, acknowledged: true }))
    .rejects.toMatchObject({ statusCode: 409, code: "BASE_CHANGED" });

  const createdRef = client.request.mock.calls.find(([route]) => route === "POST /repos/{owner}/{repo}/git/refs")[1].ref;
  const deleted = client.request.mock.calls.find(([route]) => route === "DELETE /repos/{owner}/{repo}/git/refs/{ref}");
  expect(deleted[1].ref).toBe(createdRef.replace(/^refs\//, ""));
  expect(client.request.mock.calls.some(([route]) => route === "POST /repos/{owner}/{repo}/pulls")).toBe(false);
});

test("requires both GitHub write permissions before creating any proposal ref", async () => {
  const client = setup();
  githubApp.octokit.request.mockResolvedValue({ data: { permissions: { contents: "write", pull_requests: "read" } } });

  await expect(createPullRequest(scan, finding, { patch, acknowledged: true }))
    .rejects.toMatchObject({ statusCode: 403, code: "GITHUB_WRITE_REQUIRED" });

  expect(client.request).not.toHaveBeenCalled();
});

test.each([
  ["truncated repository tree", { truncated: true }],
  ["symlink or unsupported file mode", { tree: [{ path: finding.filePath, mode: "120000" }] }],
])("refuses unsafe source metadata (%s) before creating a branch", async (_label, options) => {
  const client = setup(options);

  await expect(createPullRequest(scan, finding, { patch, acknowledged: true })).rejects.toMatchObject({ statusCode: 409 });

  expect(client.request.mock.calls.some(([route]) => route === "POST /repos/{owner}/{repo}/git/commits")).toBe(false);
  expect(client.request.mock.calls.some(([route]) => route === "POST /repos/{owner}/{repo}/git/refs")).toBe(false);
});

test("deletes only the proposal branch when GitHub refuses draft PR creation", async () => {
  const client = setup({ pullRequestFailure: new Error("GitHub unavailable") });

  await expect(createPullRequest(scan, finding, { patch, acknowledged: true })).rejects.toThrow("GitHub unavailable");

  const createdRef = client.request.mock.calls.find(([route]) => route === "POST /repos/{owner}/{repo}/git/refs")[1].ref;
  const deleted = client.request.mock.calls.find(([route]) => route === "DELETE /repos/{owner}/{repo}/git/refs/{ref}");
  expect(deleted[1].ref).toBe(createdRef.replace(/^refs\//, ""));
  expect(client.request.mock.calls.some(([route]) => /PATCH .*git\/refs|PUT .*git\/refs/.test(route))).toBe(false);
});

jest.mock("../src/models/RemediationVerification", () => ({ create: jest.fn(), find: jest.fn() }));

const RemediationVerification = require("../src/models/RemediationVerification");
const verification = require("../src/services/remediation-verification.service");

const sha = value => require("node:crypto").createHash("sha256").update(value).digest("hex");
const scan = { _id: "scan-1", organization: "org-1", owner: "team", repo: "project", commitSha: "a".repeat(40) };
const finding = { _id: "finding-1" };
const validation = {
  context: { originalCode: "const value = 1;\n", filePath: "src/index.js" },
  content: "const value = 2;\n",
  syntax: { status: "unavailable", method: "babel-parser", message: "An unsafe diagnostic detail." },
};

beforeEach(() => jest.clearAllMocks());

test("stores hashes and explicit outcomes without retaining proposed source or diagnostic text", async () => {
  RemediationVerification.create.mockImplementation(async value => value);

  const record = await verification.recordVerification({ scan, finding, actorId: "actor-1", patch: "diff text", validation, action: "validation" });

  expect(record).toMatchObject({ organization: "org-1", scan: "scan-1", finding: "finding-1", requestedBy: "actor-1",
    repository: "team/project", sourceCommitSha: scan.commitSha, targetPath: "src/index.js", action: "validation",
    patchSha256: sha("diff text"), sourceSha256: sha(validation.context.originalCode), proposedSha256: sha(validation.content) });
  expect(record.checks).toEqual([
    { name: "patch_integrity", status: "passed", method: "strict-single-file-diff", detailCode: "exact_source_context" },
    { name: "syntax", status: "unavailable", method: "babel-parser", detailCode: "parser_unavailable" },
    { name: "allowed_tests", status: "unavailable", method: null, detailCode: "isolated_runner_unavailable" },
    { name: "security_rescan", status: "unavailable", method: null, detailCode: "proposal_branch_scan_unavailable" },
  ]);
  expect(JSON.stringify(record)).not.toContain("const value =");
  expect(JSON.stringify(record)).not.toContain("unsafe diagnostic detail");
});

test("preserves failed syntax as a failed check and only accepts a GitHub-hosted pull request link", async () => {
  RemediationVerification.create.mockImplementation(async value => value);

  const record = await verification.recordVerification({ scan, finding, actorId: "actor-1", patch: "diff", action: "draft_pr",
    validation: { ...validation, syntax: { status: "failed", method: "babel-parser" } },
    pullRequest: { number: 12, url: "https://evil.example/steal", branch: "securepatch/fix-1", baseSha: scan.commitSha } });

  expect(record.checks.find(item => item.name === "syntax")).toMatchObject({ status: "failed", detailCode: "syntax_check_failed" });
  expect(record.pullRequest).toMatchObject({ number: 12, url: null, branch: "securepatch/fix-1", baseSha: scan.commitSha });
});

test("records patch-integrity failures without saving proposed source", async () => {
  RemediationVerification.create.mockImplementation(async value => value);

  const record = await verification.recordFailedIntegrity({ scan, finding, actorId: "actor-1", patch: "bad diff",
    context: { originalCode: "const sensitive = 'source';", filePath: "src/index.js" } });

  expect(record.proposedSha256).toBeNull();
  expect(record.checks.map(check => [check.name, check.status])).toEqual([
    ["patch_integrity", "failed"], ["syntax", "skipped"], ["allowed_tests", "unavailable"], ["security_rescan", "unavailable"],
  ]);
  expect(JSON.stringify(record)).not.toContain("const sensitive");
});

test("lists only records for the exact organization, scan and finding with a bounded page size", async () => {
  const records = [{ _id: "record-1" }];
  const query = { sort: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(records) };
  RemediationVerification.find.mockReturnValue(query);

  await expect(verification.listVerifications({ organizationId: "org-1", scanId: "scan-1", findingId: "finding-1", limit: 500 }))
    .resolves.toBe(records);

  expect(RemediationVerification.find).toHaveBeenCalledWith({ organization: "org-1", scan: "scan-1", finding: "finding-1" });
  expect(query.sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
  expect(query.limit).toHaveBeenCalledWith(50);
});

const { parsePatch, applyPatch } = require("diff");
const { getInstallationOctokit } = require("../config/github");
const { getFileContent, resolveCommit } = require("./github.service");
const { validateCode } = require("./code-validation");
const { bad } = require("../utils/input");
function language(file) {
  return ({ js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript", py: "python", c: "c", h: "c", cpp: "cpp", sh: "bash" })[file.split(".").pop()];
}
async function source(scan, finding) {
  if (!scan.commitSha) throw bad("Rescan this repository to pin the source commit", 409);
  if (!language(finding.filePath) || finding.filePath.split("/").some(part => part.startsWith(".") || ["node_modules", "vendor"].includes(part))) throw bad("This source path is not supported for remediation");
  const file = await getFileContent(scan.installationId, scan.owner, scan.repo, finding.filePath, scan.commitSha);
  if (file.content.length > 8000) throw bad("File exceeds the 8000-character review limit; draft a smaller manual change", 413);
  return { findingId: String(finding._id), scanId: String(scan._id), commitSha: scan.commitSha, filePath: finding.filePath,
    language: language(finding.filePath), originalCode: file.content,
    request: `Remediate the scanner finding ${finding.ruleId}: ${finding.title}. Return the complete corrected source; the application will compute a unified diff for a/${finding.filePath} and b/${finding.filePath}. Preserve behavior, avoid unrelated changes and suggest regression tests.`.slice(0, 3000) };
}
function applyExactDiff(original, patch, filePath) {
  if (typeof patch !== "string" || patch.length > 18000) throw bad("Provide a bounded unified diff");
  let entries;
  try { entries = parsePatch(patch, { strict: true }); } catch { throw bad("Invalid unified diff"); }
  if (entries.length !== 1 || entries[0].oldFileName !== `a/${filePath}` || entries[0].newFileName !== `b/${filePath}` || !entries[0].hunks.length) throw bad("Diff must modify only the selected source file");
  let content;
  try { content = applyPatch(original, entries[0], { fuzzFactor: 0 }); } catch { throw bad("Diff does not apply to the scanned source", 409); }
  if (content === false || content === original || content.length > 16000) throw bad("Diff is empty, too large, or does not match the scanned source", 409);
  return content;
}
async function validate(scan, finding, patch) {
  const context = await source(scan, finding);
  const content = applyExactDiff(context.originalCode, patch, context.filePath);
  const syntax = await validateCode(context.language, content);
  if (syntax.status === "failed") throw bad("Proposed source failed syntax validation");
  return { context, content, syntax };
}
async function createPullRequest(scan, finding, { patch, acknowledged }) {
  if (acknowledged !== true) throw bad("Review the diff and acknowledge unexecuted tests before creating a draft PR");
  const { context, content, syntax } = await validate(scan, finding, patch);
  const current = await resolveCommit(scan.installationId, scan.owner, scan.repo);
  if (current.sha !== scan.commitSha) throw bad("The default branch changed. Rescan before creating the PR.", 409, "BASE_CHANGED");
  const client = await getInstallationOctokit(scan.installationId);
  const { data: installation } = await require("../config/github").githubApp.octokit.request("GET /app/installations/{installation_id}", { installation_id: scan.installationId });
  if (installation.permissions?.contents !== "write" || installation.permissions?.pull_requests !== "write") throw bad("Approve Contents and Pull requests write permissions for the GitHub App to enable draft PRs.", 403, "GITHUB_WRITE_REQUIRED");
  await require("./budget.service").consume(`pr:${scan.organization}`, 10, 3600000);
  const base = { owner: scan.owner, repo: scan.repo };
  const branch = `securepatch/fix-${finding._id}-${require("node:crypto").randomBytes(4).toString("hex")}`;
  const { data: commit } = await client.request("GET /repos/{owner}/{repo}/git/commits/{commit_sha}", { ...base, commit_sha: current.sha });
  const { data: baseTree } = await client.request("GET /repos/{owner}/{repo}/git/trees/{tree_sha}", { ...base, tree_sha: commit.tree.sha, recursive: "true" });
  const originalEntry = baseTree.tree.find(entry => entry.path === context.filePath);
  if (baseTree.truncated || !["100644", "100755"].includes(originalEntry?.mode)) throw bad("Cannot safely preserve this source file's mode", 409);
  const { data: tree } = await client.request("POST /repos/{owner}/{repo}/git/trees", { ...base, base_tree: commit.tree.sha,
    tree: [{ path: context.filePath, mode: originalEntry.mode, type: "blob", content }] });
  const { data: proposal } = await client.request("POST /repos/{owner}/{repo}/git/commits", { ...base,
    message: `Propose remediation for ${finding.ruleId}`.slice(0, 150), tree: tree.sha, parents: [current.sha] });
  await client.request("POST /repos/{owner}/{repo}/git/refs", { ...base, ref: `refs/heads/${branch}`, sha: proposal.sha });
  try {
    const { data: pr } = await client.request("POST /repos/{owner}/{repo}/pulls", { ...base, head: branch, base: current.branch, draft: true,
      title: `Review remediation: ${finding.ruleId}`.slice(0, 200),
      body: `Draft remediation for ${finding.ruleId} in ${context.filePath}.\n\nBase commit: ${current.sha}\nSyntax: ${syntax.status}.\nTests were not executed. The patch requires independent correctness and security review.\n\nScanner severity: ${finding.severity}; SecurePatch risk: ${finding.riskScore} (not a probability).` });
    return { url: pr.html_url, number: pr.number, draft: true, branch, syntax, tests: "not_executed" };
  } catch (error) {
    // Remove only the new proposal branch if PR creation failed; base refs are never changed.
    await client.request("DELETE /repos/{owner}/{repo}/git/refs/{ref}", { ...base, ref: `heads/${branch}` }).catch(() => {});
    throw error;
  }
}
module.exports = { source, applyExactDiff, validate, createPullRequest };

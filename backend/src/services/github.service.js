const { getInstallationOctokit } = require("../config/github");
const { bad, repository } = require("../utils/input");
const cache = new Map();
async function getRepositories(installationId, { forceRefresh = false } = {}) {
  const key = String(installationId), cached = cache.get(key);
  if (!forceRefresh && cached?.until > Date.now()) return cached.data;
  const request = { until: 0 };
  if (cache.size > 100) cache.clear();
  cache.set(key, request);
  const client = await getInstallationOctokit(installationId);
  const records = await client.paginate("GET /installation/repositories", { per_page: 100 });
  const data = records.map(repo => ({ id: repo.id, name: repo.name, fullName: repo.full_name,
    owner: repo.owner.login, private: repo.private, defaultBranch: repo.default_branch }));
  // A slower request must not replace a newer access refresh.
  if (cache.get(key) === request) cache.set(key, { until: Date.now() + 30000, data });
  return data;
}
async function resolveCommit(installationId, owner, repo, ref) {
  repository(owner, repo);
  const client = await getInstallationOctokit(installationId);
  const { data: metadata } = await client.request("GET /repos/{owner}/{repo}", { owner, repo });
  const { data } = await client.request("GET /repos/{owner}/{repo}/commits/{ref}", { owner, repo, ref: ref || metadata.default_branch });
  if (!/^[a-f0-9]{40}$/.test(data.sha)) throw bad("GitHub returned an invalid commit", 502);
  return { sha: data.sha, branch: metadata.default_branch, permissions: metadata.permissions };
}
async function getRepositoryMetadata(installationId, owner, repo) {
  repository(owner, repo);
  const client = await getInstallationOctokit(installationId);
  const { data } = await client.request("GET /repos/{owner}/{repo}", { owner, repo });
  return {
    id: data.id,
    name: data.name,
    fullName: data.full_name,
    owner: data.owner?.login || owner,
    private: Boolean(data.private),
    defaultBranch: data.default_branch || null,
    htmlUrl: data.html_url || null,
  };
}
async function getRepositoryFiles(installationId, owner, repo) {
  const commit = await resolveCommit(installationId, owner, repo);
  const client = await getInstallationOctokit(installationId);
  const { data } = await client.request("GET /repos/{owner}/{repo}/git/trees/{tree_sha}", {
    owner, repo, tree_sha: commit.sha, recursive: "true",
  });
  if (data.truncated) throw bad("Repository tree exceeds GitHub's recursive limit. Use a smaller repository or direct file path.", 413, "TREE_TRUNCATED");
  return data.tree.filter(item => item.type === "blob").map(item => ({ path: item.path, size: item.size, commitSha: commit.sha }));
}
async function getFileContent(installationId, owner, repo, filePath, ref, { preview = false } = {}) {
  repository(owner, repo);
  const normalizedPath = String(filePath || "").replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\//, "");
  if (typeof filePath !== "string" || normalizedPath.length > 1000 || normalizedPath.split("/").some(p => p === ".." || p === ".")) throw bad("Invalid file path");
  const client = await getInstallationOctokit(installationId);
  const { data } = await client.request("GET /repos/{owner}/{repo}/contents/{path}", { owner, repo, path: normalizedPath, ...(ref ? { ref } : {}) });
  if (Array.isArray(data) || data.type !== "file" || data.target || data.submodule_git_url) throw bad("Only regular files can be viewed");
  if (data.size > 256 * 1024 || data.encoding !== "base64" || typeof data.content !== "string") throw bad("File is too large or not available as inline text", 413, "FILE_UNSUPPORTED");
  const buffer = Buffer.from(data.content, "base64");
  if (buffer.length > 256 * 1024) throw bad("File exceeds the 256 KB preview limit. Open it on GitHub.", 413, "FILE_UNSUPPORTED");
  if (preview && /\.(?:png|jpe?g|gif|webp|ico)$/i.test(filePath)) {
    const signature = buffer.subarray(0, 12);
    const mimeType = signature.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? "image/png"
      : signature.subarray(0, 3).equals(Buffer.from([255,216,255])) ? "image/jpeg"
      : /^(?:GIF87a|GIF89a)$/.test(signature.subarray(0, 6).toString("ascii")) ? "image/gif"
      : signature.subarray(0, 4).toString("ascii") === "RIFF" && signature.subarray(8, 12).toString("ascii") === "WEBP" ? "image/webp"
      : signature.subarray(0, 4).equals(Buffer.from([0,0,1,0])) ? "image/x-icon" : null;
    if (!mimeType) throw bad("This image format could not be verified. Open it on GitHub.", 415, "FILE_UNSUPPORTED");
    return { path: data.path, name: data.name, size: data.size, sha: data.sha, kind: "image", encoding: "base64", mimeType, content: buffer.toString("base64") };
  }
  if (buffer.includes(0)) throw bad("Binary files are not supported", 415, "BINARY_FILE");
  return { path: data.path, name: data.name, size: data.size, sha: data.sha, content: buffer.toString("utf8") };
}
module.exports = { getRepositories, getRepositoryMetadata, resolveCommit, getRepositoryFiles, getFileContent };

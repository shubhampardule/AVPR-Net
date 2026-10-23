const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");
const AdmZip = require("adm-zip");
const { getInstallationOctokit } = require("../config/github");
const { repository, bad } = require("../utils/input");
const { fromResponse: githubRateLimit } = require("../utils/github-rate-limit");
const context = require("./scan-context");
const MAX_ARCHIVE = 50 * 1024 * 1024;
const MAX_EXPANDED = 200 * 1024 * 1024;
async function archiveRateLimit(response) {
  let message = "";
  if (response.status === 403 && response.body) {
    const reader = response.clone().body?.getReader();
    if (reader) {
      const decoder = new TextDecoder();
      let text = "", bytes = 0;
      try {
        while (bytes < 4096) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = value.subarray(0, 4096 - bytes);
          bytes += chunk.byteLength;
          text += decoder.decode(chunk, { stream: bytes < 4096 });
          if (bytes === 4096) await reader.cancel();
        }
        text += decoder.decode();
        try { message = JSON.parse(text).message || text; } catch { message = text; }
      } catch { /* A malformed upstream error body must not hide the original response. */ }
    }
  }
  return githubRateLimit({ status: response.status, headers: response.headers, message });
}
async function signedArchiveUrl(installationId, owner, repo, ref) {
  repository(owner, repo);
  if (!/^[a-f0-9]{40}$/.test(ref || "")) throw bad("An immutable commit SHA is required");
  const client = await getInstallationOctokit(installationId);
  const { token } = await client.auth({ type: "installation" });
  const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/zipball/${ref}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "AVPR-Net" },
    redirect: "manual", signal: AbortSignal.timeout(15000),
  });
  await response.body?.cancel();
  if (![301, 302, 307, 308].includes(response.status)) throw bad("GitHub archive unavailable", 502);
  const url = new URL(response.headers.get("location"));
  if (url.protocol !== "https:" || url.hostname !== "codeload.github.com" || url.port || url.username || url.password) throw bad("Unexpected archive host", 502);
  return url.toString();
}
async function download(installationId, owner, repo, ref) {
  const client = await getInstallationOctokit(installationId);
  const { token } = await client.auth({ type: "installation" });
  const signal = AbortSignal.any([AbortSignal.timeout(30000), ...(context.getStore()?.signal ? [context.getStore().signal] : [])]);
  let response = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/zipball/${encodeURIComponent(ref)}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "AVPR-Net" }, redirect: "manual", signal,
  });
  if ([301, 302, 307, 308].includes(response.status)) {
    const url = new URL(response.headers.get("location"));
    await response.body?.cancel();
    if (url.protocol !== "https:" || url.hostname !== "codeload.github.com" || url.port || url.username || url.password) throw bad("Unexpected archive host", 502);
    response = await fetch(url, { redirect: "error", signal });
  }
  if (!response.ok || !response.body) {
    const limited = await archiveRateLimit(response);
    await response.body?.cancel().catch(() => {});
    if (limited) throw limited;
    throw bad("GitHub archive download failed", 502);
  }
  if (Number(response.headers.get("content-length")) > MAX_ARCHIVE) { await response.body.cancel(); throw bad("Repository archive exceeds 50 MiB", 413); }
  const parts = []; let bytes = 0;
  for await (const part of response.body) {
    bytes += part.byteLength;
    if (bytes > MAX_ARCHIVE) { throw bad("Repository archive exceeds 50 MiB", 413); }
    parts.push(Buffer.from(part));
  }
  return Buffer.concat(parts);
}
async function createEphemeralWorkspace(installationId, owner, repo, ref) {
  repository(owner, repo);
  if (!/^[a-f0-9]{40}$/.test(ref || "")) throw bad("An immutable commit SHA is required");
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "securepatch-"));
  const workspacePath = path.join(base, "workspace");
  let scannerWorkspacePath = workspacePath;
  const cleanup = async () => {
    const relative = path.relative(path.resolve(os.tmpdir()), path.resolve(base));
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Unsafe workspace cleanup path");
    try { await require("../scanners/process").cleanupWslWorkspace(scannerWorkspacePath); }
    finally { fs.rmSync(base, { recursive: true, force: true }); }
  };
  try {
    const zip = new AdmZip(await download(installationId, owner, repo, ref));
    const entries = zip.getEntries();
    if (entries.length > 20000) throw bad("Repository contains too many archive entries", 413);
    let expanded = 0;
    for (const entry of entries) {
      const name = entry.entryName;
      expanded += entry.header.size;
      if (expanded > MAX_EXPANDED || entry.header.size > 20 * 1024 * 1024) throw bad("Expanded archive limit exceeded", 413);
      if (name.startsWith("/") || name.includes("\\") || name.split("/").includes("..") || /^[A-Za-z]:/.test(name) || ((entry.attr >>> 16) & 0xf000) === 0xa000) throw bad("Unsafe archive path or symbolic link");
    }
    fs.mkdirSync(workspacePath);
    zip.extractAllTo(workspacePath, false);
    const names = fs.readdirSync(workspacePath);
    const nested = names.length === 1 && fs.lstatSync(path.join(workspacePath, names[0])).isDirectory();
    scannerWorkspacePath = nested ? path.join(workspacePath, names[0]) : workspacePath;
    return { workspacePath: scannerWorkspacePath, cleanup };
  } catch (error) { await cleanup(); throw error; }
}
module.exports = { createEphemeralWorkspace, download, signedArchiveUrl };

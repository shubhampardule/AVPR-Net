jest.mock("../src/config/github", () => require("./__mocks__/github"));
const AdmZip = require("adm-zip");
const fs = require("node:fs");
const { getInstallationOctokit } = require("../src/config/github");
const { createEphemeralWorkspace } = require("../src/services/workspace.service");
const sha = "a".repeat(40);
beforeEach(() => {
  getInstallationOctokit.mockResolvedValue({ auth: async () => ({ token: "synthetic-installation-token" }) });
});
afterEach(() => jest.restoreAllMocks());
function archive() { const zip = new AdmZip(); zip.addFile("repo-root/src/example.js", Buffer.from("const value = 1;")); return zip; }
test("bounded archive extraction uses the pinned commit and guarantees cleanup", async () => {
  const fetch = jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(archive().toBuffer()));
  const result = await createEphemeralWorkspace("1", "owner", "repo", sha);
  expect(fetch.mock.calls[0][0]).toContain(sha);
  expect(fs.readFileSync(`${result.workspacePath}/src/example.js`, "utf8")).toBe("const value = 1;");
  await result.cleanup(); expect(fs.existsSync(result.workspacePath)).toBe(false);
});
test("oversized declared archive fails before extraction", async () => {
  jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response("small", { headers: { "content-length": String(51 * 1024 * 1024) } }));
  await expect(createEphemeralWorkspace("1", "owner", "repo", sha)).rejects.toMatchObject({ statusCode: 413 });
});
test("GitHub archive rate limits return a retryable 429", async () => {
  jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response("rate limited", {
    status: 429,
    headers: { "retry-after": "23" },
  }));
  await expect(createEphemeralWorkspace("1", "owner", "repo", sha)).rejects.toMatchObject({
    statusCode: 429,
    code: "GITHUB_RATE_LIMITED",
    retryAfterSeconds: 23,
  });
});
test("GitHub secondary archive limits without Retry-After use the documented minimum wait", async () => {
  jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ message: "You have exceeded a secondary rate limit." }), {
    status: 403,
    headers: { "content-type": "application/json", "x-github-request-id": "ABC:321" },
  }));
  await expect(createEphemeralWorkspace("1", "owner", "repo", sha)).rejects.toMatchObject({
    statusCode: 429,
    code: "GITHUB_RATE_LIMITED",
    retryAfterSeconds: 60,
  });
});
test("symbolic link entries are rejected", async () => {
  const zip = archive(); zip.getEntry("repo-root/src/example.js").attr = (0xa1ff << 16) >>> 0;
  jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(zip.toBuffer()));
  await expect(createEphemeralWorkspace("1", "owner", "repo", sha)).rejects.toThrow("Unsafe archive path");
});
test("installation credentials are never forwarded to untrusted archive redirects", async () => {
  const fetch = jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 302, headers: { location: "https://untrusted.example/archive" } }));
  await expect(createEphemeralWorkspace("1", "owner", "repo", sha)).rejects.toThrow("Unexpected archive host");
  expect(fetch).toHaveBeenCalledTimes(1);
});
test("moving HEAD is rejected without making a request", async () => {
  const fetch = jest.spyOn(globalThis, "fetch");
  await expect(createEphemeralWorkspace("1", "owner", "repo", "HEAD")).rejects.toThrow("immutable commit");
  expect(fetch).not.toHaveBeenCalled();
});

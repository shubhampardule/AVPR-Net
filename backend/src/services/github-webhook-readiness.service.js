const { createHash } = require("node:crypto");
let cached;

async function getWebhookReadiness({ force = false } = {}) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET?.trim();
  const unavailable = issue => ({ push: false, pullRequest: false, issue });
  if (!secret) return unavailable("WEBHOOK_SECRET_MISSING");
  let expected;
  try {
    expected = new URL(process.env.GITHUB_WEBHOOK_URL || "/api/v1/webhooks/github", process.env.FRONTEND_URL);
    if (expected.protocol !== "https:" || expected.username || expected.password || expected.search || expected.hash ||
      expected.pathname !== "/api/v1/webhooks/github") throw new Error("Invalid public endpoint");
  } catch { return unavailable("WEBHOOK_PUBLIC_URL_MISSING"); }
  const key = createHash("sha256").update(secret).update("\0").update(expected.href).digest("hex");
  if (!force && cached?.key === key && cached.until > Date.now()) return cached.result;
  let result;
  try {
    const { githubApp } = require("../config/github");
    const [app, hook] = await Promise.all([
      githubApp.octokit.request("GET /app", { request: { timeout: 8000 } }),
      githubApp.octokit.request("GET /app/hook/config", { request: { timeout: 8000 } }),
    ]);
    if (hook.data?.url !== expected.href || hook.data?.content_type !== "json" || String(hook.data?.insecure_ssl) !== "0" || !hook.data?.secret) {
      result = unavailable("WEBHOOK_REMOTE_CONFIGURATION_MISMATCH");
    } else {
      const events = new Set(Array.isArray(app.data?.events) ? app.data.events : []);
      result = { push: events.has("push"), pullRequest: events.has("pull_request"),
        issue: events.has("push") && events.has("pull_request") ? null : "WEBHOOK_SUBSCRIPTION_MISSING" };
    }
  } catch { result = unavailable("WEBHOOK_CONFIGURATION_UNVERIFIED"); }
  // No remote payloads, credential values or provider errors leave this boundary.
  cached = { key, until: Date.now() + 15000, result: Object.freeze(result) };
  return cached.result;
}

module.exports = { getWebhookReadiness };

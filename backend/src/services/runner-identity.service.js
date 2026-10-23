const crypto = require("node:crypto");
const { bad } = require("../utils/input");
const ISSUER = "https://token.actions.githubusercontent.com";
const REPOSITORY = "shubhampardule/AVPR-Net";
const AUDIENCE = "https://avpr-psi.vercel.app/project-tests";
let cached;
function validateClaims(claims, now = Date.now() / 1000, expectedSha = process.env.PROJECT_TEST_RUNNER_SHA) {
  if (!/^[a-f0-9]{40}$/.test(expectedSha || "")) throw bad("Project-test runner is not configured", 503);
  if (claims.iss !== ISSUER || claims.aud !== AUDIENCE || claims.repository !== REPOSITORY ||
      claims.repository_id !== "1425869481" || claims.repository_owner_id !== "166275831" ||
      claims.ref !== "refs/heads/main" || claims.sub !== `repo:${REPOSITORY}:ref:refs/heads/main` ||
      claims.workflow_ref !== `${REPOSITORY}/.github/workflows/project-tests.yml@refs/heads/main` ||
      claims.sha !== expectedSha || claims.workflow_sha !== expectedSha ||
      !["repository_dispatch", "workflow_dispatch"].includes(claims.event_name) ||
      claims.runner_environment !== "github-hosted" || !/^\d+$/.test(claims.run_id || "") || !/^[1-9]\d*$/.test(claims.run_attempt || "") ||
      !Number.isFinite(claims.exp) || claims.exp <= now || claims.exp > now + 600 ||
      !Number.isFinite(claims.nbf) || claims.nbf > now + 15 || !Number.isFinite(claims.iat) || claims.iat > now + 15 || claims.iat < now - 600)
    throw bad("Runner identity was refused", 401);
  return { runId: claims.run_id, revision: claims.sha, attempt: claims.run_attempt };
}
async function verify(token) {
  if (typeof token !== "string" || token.length > 16000) throw bad("Runner identity required", 401);
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some(value => !/^[A-Za-z0-9_-]+$/.test(value))) throw bad("Invalid runner identity", 401);
  let header, claims;
  try { header = JSON.parse(Buffer.from(parts[0], "base64url")); claims = JSON.parse(Buffer.from(parts[1], "base64url")); }
  catch { throw bad("Invalid runner identity", 401); }
  if (header.alg !== "RS256" || typeof header.kid !== "string") throw bad("Invalid runner identity", 401);
  const identity = validateClaims(claims);
  if (!cached || cached.until < Date.now()) {
    const response = await fetch(`${ISSUER}/.well-known/jwks`, { signal: AbortSignal.timeout(5000), redirect: "error" });
    if (!response.ok) throw bad("Runner identity provider unavailable", 503);
    const text = await response.text();
    if (text.length > 100000) throw bad("Runner identity provider unavailable", 503);
    const data = JSON.parse(text);
    if (!Array.isArray(data.keys)) throw bad("Runner identity provider unavailable", 503);
    cached = { keys: data.keys, until: Date.now() + 300000 };
  }
  const jwk = cached.keys.find(key => key.kid === header.kid && key.kty === "RSA" && key.use === "sig" && key.alg === "RS256");
  if (!jwk || !crypto.verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`),
    crypto.createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(parts[2], "base64url"))) throw bad("Runner signature was refused", 401);
  return identity;
}
module.exports = { verify, validateClaims, AUDIENCE };

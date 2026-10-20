const crypto = require("node:crypto");
const env = require("../config/env");
const User = require("../models/User");
const safeReturnTo = require("../utils/safeReturnTo");

const frontend = () => process.env.FRONTEND_URL || "http://localhost:5174";
const failure = (res, code) => res.redirect(`${frontend()}/login?error=${code}`);
const saveSession = (req) => new Promise((resolve, reject) => req.session.save((error) => error ? reject(error) : resolve()));

async function githubRequest(path, token) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "User-Agent": "AVPR-Net" },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw Object.assign(new Error("GitHub could not verify account access. Try signing in again."), { statusCode: 502 });
  return response.json();
}

async function manageableInstallations(token, profile) {
  const data = await githubRequest("/user/installations?per_page=100", token);
  const installations = [];
  for (const installation of data.installations || []) {
    let canManage = String(installation.account?.id) === String(profile.id);
    if (!canManage && installation.account?.type === "Organization") {
      try {
        const membership = await githubRequest(`/user/memberships/orgs/${encodeURIComponent(installation.account.login)}`, token);
        canManage = membership.state === "active" && membership.role === "admin";
      } catch { /* Organization installations require verified administrator access. */ }
    }
    if (canManage) installations.push({
      id: installation.id, account: installation.account.login,
      accountType: installation.account.type, htmlUrl: installation.html_url,
    });
  }
  return installations;
}

async function startGitHubLogin(req, res, next) {
  if (!env.github.clientId || !env.github.clientSecret || !env.github.callbackUrl) {
    return failure(res, "github_unavailable");
  }
  try {
    const state = crypto.randomBytes(32).toString("base64url");
    const verifier = crypto.randomBytes(32).toString("base64url");
    req.session.githubOAuth = { state, verifier, createdAt: Date.now(), userId: req.user?.id || null,
      returnTo: safeReturnTo(req.query.returnTo) };
    await saveSession(req);
    const url = new URL("https://github.com/login/oauth/authorize");
    url.search = new URLSearchParams({
      client_id: env.github.clientId, redirect_uri: env.github.callbackUrl,
      state, code_challenge: crypto.createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
    }).toString();
    return res.redirect(url.toString());
  } catch (error) { next(error); }
}

async function finishGitHubLogin(req, res, next) {
  const oauth = req.session.githubOAuth;
  delete req.session.githubOAuth;
  try {
    // Consume the state before exchanging a code, including failed attempts.
    await saveSession(req);
    const state = Buffer.from(typeof req.query.state === "string" ? req.query.state : "");
    const expected = Buffer.from(oauth?.state || "");
    if (!expected.length || state.length !== expected.length ||
        !crypto.timingSafeEqual(state, expected) ||
        Date.now() - oauth.createdAt > 10 * 60 * 1000 ||
        (oauth.userId && oauth.userId !== req.user?.id)) return failure(res, "github_state");
    if (req.query.error || typeof req.query.code !== "string") return failure(res, "github_denied");

    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: env.github.clientId, client_secret: env.github.clientSecret,
        redirect_uri: env.github.callbackUrl, code: req.query.code, code_verifier: oauth.verifier }),
      signal: AbortSignal.timeout(15000),
    });
    const credentials = await response.json();
    if (!response.ok || !credentials.access_token) return failure(res, "github_denied");
    const token = credentials.access_token;
    const profile = await githubRequest("/user", token);
    const emails = await githubRequest("/user/emails", token);
    const verified = emails.filter((email) => email.verified);
    const email = (verified.find((item) => item.primary) || verified[0])?.email?.toLowerCase();
    if (!email) return failure(res, "github_email");
    let user = await User.findOne({ githubId: String(profile.id) });
    if (oauth.userId && user && user.id !== oauth.userId) return failure(res, "github_conflict");
    if (!user) user = oauth.userId ? await User.findById(oauth.userId) : await User.findOne({ email });
    if (user?.githubId && user.githubId !== String(profile.id)) return failure(res, "github_conflict");
    if (user && user.status !== "active") return failure(res, "account_inactive");
    if (!user) user = await User.create({ name: (profile.name || profile.login).slice(0, 100), email,
      profileImage: profile.avatar_url || null, githubId: String(profile.id), githubUsername: profile.login });
    else {
      user.githubId = String(profile.id);
      user.githubUsername = profile.login;
      await user.save();
    }
    const installations = await manageableInstallations(token, profile);
    await new Promise((resolve, reject) => req.logIn(user, (error) => error ? reject(error) : resolve()));
    // Keep only verified installation metadata. OAuth tokens are never persisted.
    req.session.githubAccess = { userId: user.id, installations, checkedAt: Date.now() };
    await saveSession(req);
    return res.redirect(`${frontend()}${oauth.userId ? "/github" : oauth.returnTo || "/dashboard"}`);
  } catch (error) { next(error); }
}

function authorizedInstallations(req) {
  const access = req.session?.githubAccess;
  return access?.userId === req.user?.id && Date.now() - access.checkedAt < 60 * 60 * 1000
    ? access.installations : [];
}

module.exports = { startGitHubLogin, finishGitHubLogin, authorizedInstallations };

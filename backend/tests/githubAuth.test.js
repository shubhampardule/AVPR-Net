jest.mock("../src/config/env", () => ({ github: {
  clientId: "test-client", clientSecret: "test-secret", callbackUrl: "https://example.test/api/v1/auth/github/callback",
} }));
jest.mock("../src/models/User", () => ({ findOne: jest.fn(), findById: jest.fn(), create: jest.fn() }));
jest.mock("../src/models/Organization", () => ({ findById: jest.fn() }));
jest.mock("../src/services/audit.service", () => ({ recordAuditEvent: jest.fn().mockResolvedValue(null) }));
const User = require("../src/models/User");
const Organization = require("../src/models/Organization");
const { recordAuditEvent } = require("../src/services/audit.service");
const { startGitHubLogin, finishGitHubLogin, authorizedInstallations, githubAuthorization } = require("../src/controllers/githubAuth.controller");
const { connectGitHubInstallation } = (() => {
  jest.mock("../src/config/github", () => require("./__mocks__/github"));
  return require("../src/controllers/github.controller");
})();
const { githubApp } = require("../src/config/github");
const originalFetch = global.fetch;
const state = "secure-state";
const buildRequest = () => ({
  query: { state, code: "one-use-code" },
  session: { githubOAuth: { state, verifier: "pkce-verifier", createdAt: Date.now() }, save: jest.fn((done) => done()) },
  logIn: jest.fn((user, done) => done()),
});
const buildResponse = () => ({ redirect: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() });
const ok = (data) => ({ ok: true, json: async () => data });
const user = () => ({ id: "user-1", status: "active", email: "verified@example.test", save: jest.fn().mockResolvedValue() });

beforeEach(() => { jest.clearAllMocks(); global.fetch = jest.fn(); });
afterAll(() => { global.fetch = originalFetch; });

test("sign-in saves unpredictable state and a PKCE challenge before redirecting", async () => {
  const req = buildRequest(), res = buildResponse(), next = jest.fn();
  req.query.returnTo = "/invite/accept?token=invitation-token";
  await startGitHubLogin(req, res, next);
  const url = new URL(res.redirect.mock.calls[0][0]);
  expect(req.session.save).toHaveBeenCalled();
  expect(url.searchParams.get("state")).toBe(req.session.githubOAuth.state);
  expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  expect(url.searchParams.get("code_challenge")).toHaveLength(43);
  expect(req.session.githubOAuth.returnTo).toBe("/invite/accept?token=invitation-token");
  expect(next).not.toHaveBeenCalled();
});

test("OAuth return paths cannot redirect GitHub sign-in to an external site", async () => {
  const req = buildRequest(), res = buildResponse();
  req.query.returnTo = "//attacker.example/path";
  await startGitHubLogin(req, res, jest.fn());
  expect(req.session.githubOAuth.returnTo).toBeNull();
});

test.each(["missing", "mismatch", "expired", "switched-account"])("rejects %s state without exchanging a code", async (kind) => {
  const req = buildRequest(), res = buildResponse();
  if (kind === "missing") delete req.session.githubOAuth;
  if (kind === "mismatch") req.query.state = "wrong";
  if (kind === "expired") req.session.githubOAuth.createdAt -= 11 * 60 * 1000;
  if (kind === "switched-account") req.session.githubOAuth.userId = "different-user";
  await finishGitHubLogin(req, res, jest.fn());
  expect(global.fetch).not.toHaveBeenCalled();
  expect(req.session.githubOAuth).toBeUndefined();
  expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("error=github_state"));
});

test("cancelled consent consumes state and does not log in", async () => {
  const req = buildRequest(), res = buildResponse();
  req.query.error = "access_denied";
  await finishGitHubLogin(req, res, jest.fn());
  expect(req.logIn).not.toHaveBeenCalled();
  expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("github_denied"));
});

function mockIdentity(emails = [{ email: "verified@example.test", primary: true, verified: true }]) {
  global.fetch.mockResolvedValueOnce(ok({ access_token: "ephemeral-token" }))
    .mockResolvedValueOnce(ok({ id: 123, login: "developer", name: "Developer" }))
    .mockResolvedValueOnce(ok(emails));
}

test("links an existing verified-email account and retains only owned installation metadata", async () => {
  const req = buildRequest(), res = buildResponse(), existing = user(), next = jest.fn();
  User.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(existing);
  mockIdentity();
  global.fetch.mockResolvedValueOnce(ok({ installations: [
    { id: 10, account: { id: 123, login: "developer", type: "User" } },
    { id: 20, account: { id: 456, login: "someone-else", type: "User" } },
  ] }));
  await finishGitHubLogin(req, res, next);
  expect(User.findOne).toHaveBeenLastCalledWith({ email: "verified@example.test" });
  expect(existing.githubId).toBe("123");
  expect(req.logIn).toHaveBeenCalledWith(existing, expect.any(Function));
  expect(req.session.githubAccess.installations.map((item) => item.id)).toEqual([10]);
  expect(JSON.stringify(req.session)).not.toContain("ephemeral-token");
  expect(JSON.parse(global.fetch.mock.calls[0][1].body).code_verifier).toBe("pkce-verifier");
  expect(next).not.toHaveBeenCalled();
});

test("new GitHub sign-in returns to the requested local invitation path", async () => {
  const req = buildRequest(), res = buildResponse();
  req.session.githubOAuth.returnTo = "/invite/accept?token=abc";
  User.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
  User.create.mockResolvedValue(user());
  mockIdentity();
  global.fetch.mockResolvedValueOnce(ok({ installations: [] }));
  await finishGitHubLogin(req, res, jest.fn());
  expect(res.redirect).toHaveBeenCalledWith("http://localhost:5174/invite/accept?token=abc");
});

test("unverified GitHub emails cannot claim an existing account", async () => {
  const req = buildRequest(), res = buildResponse();
  mockIdentity([{ email: "verified@example.test", primary: true, verified: false }]);
  await finishGitHubLogin(req, res, jest.fn());
  expect(User.findOne).not.toHaveBeenCalled();
  expect(req.logIn).not.toHaveBeenCalled();
  expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("github_email"));
});

test("an authenticated linking attempt cannot take over another linked account", async () => {
  const req = buildRequest(), res = buildResponse();
  req.user = { id: "user-1" };
  req.session.githubOAuth.userId = "user-1";
  User.findOne.mockResolvedValueOnce({ id: "user-2" });
  mockIdentity();
  await finishGitHubLogin(req, res, jest.fn());
  expect(req.logIn).not.toHaveBeenCalled();
  expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("github_conflict"));
});

test("expired or another user's installation grants are unusable", () => {
  const req = { user: { id: "user-1" }, session: { githubAccess: {
    userId: "user-1", checkedAt: Date.now() - 61 * 60 * 1000, installations: [{ id: 10 }],
  } } };
  expect(authorizedInstallations(req)).toEqual([]);
  req.session.githubAccess.checkedAt = Date.now();
  req.session.githubAccess.userId = "user-2";
  expect(authorizedInstallations(req)).toEqual([]);
});

test("fresh GitHub authorization is verified even when the account has no installations", () => {
  const req = { user: { id: "user-1", githubUsername: "developer" }, session: { githubAccess: {
    userId: "user-1", checkedAt: Date.now(), installations: [],
  } } };
  expect(githubAuthorization(req)).toEqual({verified:true,username:"developer"});
  expect(authorizedInstallations(req)).toEqual([]);
});
test.each(["missing", "expired", "different-user", "future"])("%s authorization cannot be inferred from a linked GitHub username", kind => {
  const req = { user: { id: "user-1", githubUsername: "developer" }, session: { githubAccess: {
    userId: "user-1", checkedAt: Date.now(), installations:[{id:10}],
  } } };
  if (kind === "missing") delete req.session.githubAccess;
  if (kind === "expired") req.session.githubAccess.checkedAt -= 61 * 60000;
  if (kind === "different-user") req.session.githubAccess.userId = "user-2";
  if (kind === "future") req.session.githubAccess.checkedAt += 60000;
  expect(githubAuthorization(req)).toEqual({verified:false,username:"developer"});
  expect(authorizedInstallations(req)).toEqual([]);
});

test("connecting an unapproved installation is forbidden before any GitHub app request", async () => {
  const req = { user: { id: "user-1" }, session: {}, params: { organizationId: "org-1" }, body: { installationId: "999" } };
  const res = buildResponse();
  await connectGitHubInstallation(req, res, jest.fn());
  expect(res.status).toHaveBeenCalledWith(403);
  expect(githubApp.octokit.request).not.toHaveBeenCalled();
});

test("an authorized GitHub installation is connected and recorded without token data", async () => {
  const organization = { id: "org-1", save: jest.fn().mockResolvedValue() };
  Organization.findById.mockResolvedValue(organization);
  githubApp.octokit.request.mockResolvedValue({ data: {
    id: 10, account: { login: "team", type: "Organization" }, html_url: "https://github.com/settings/installations/10",
  } });
  const req = {
    user: { _id: "user-1", id: "user-1", name: "Reviewer" },
    session: { githubAccess: { userId: "user-1", checkedAt: Date.now(), installations: [{ id: 10, account: "team" }] } },
    params: { organizationId: "org-1" }, body: { installationId: "10" }, requestId: "req-1",
  };
  const res = buildResponse();

  await connectGitHubInstallation(req, res, jest.fn());

  expect(organization.githubInstallationId).toBe("10");
  expect(organization.save).toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  expect(recordAuditEvent).toHaveBeenCalledWith(req, expect.objectContaining({
    action: "github.installation_connected", details: { installationId: "10", account: "team", accountType: "Organization" },
  }));
});

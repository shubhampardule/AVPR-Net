jest.mock("../src/models/Organization", () => ({ findById: jest.fn() }));
jest.mock("../src/config/github", () => ({ githubApp: { octokit: { request: jest.fn() } } }));
jest.mock("../src/controllers/githubAuth.controller", () => ({ authorizedInstallations: jest.fn(() => []) }));
jest.mock("../src/services/audit.service", () => ({ recordAuditEvent: jest.fn().mockResolvedValue(null) }));

const Organization = require("../src/models/Organization");
const { githubApp } = require("../src/config/github");
const { getGitHubStatus } = require("../src/controllers/github.controller");
const { recordAuditEvent } = require("../src/services/audit.service");

const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });
const organization = () => ({ githubInstallationId: "10", save: jest.fn().mockResolvedValue() });

beforeEach(() => jest.clearAllMocks());

test("a revoked GitHub App installation is cleared and reported as recoverable", async () => {
  const org = organization();
  Organization.findById.mockResolvedValue(org);
  githubApp.octokit.request.mockRejectedValue(Object.assign(new Error("Not Found"), { status: 404 }));
  const req = {
    params: { organizationId: "org-1" },
    session: {
      githubAccess: { installations: [{ id: 10 }, { id: 11 }] },
      save: jest.fn((done) => done()),
    },
  };
  const res = response();

  await getGitHubStatus(req, res, jest.fn());

  expect(org.githubInstallationId).toBeNull();
  expect(org.save).toHaveBeenCalledTimes(1);
  expect(req.session.githubAccess.installations).toEqual([{ id: 11 }]);
  expect(req.session.save).toHaveBeenCalledTimes(1);
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
    data: { connected: false, installation: null, revoked: true, revokedInstallationId: "10" },
  }));
  expect(recordAuditEvent).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({
    action: "github.installation_disconnected", details: { installationId: "10", reason: "revoked" },
  }));
});

test("a temporary GitHub API failure does not erase the saved installation", async () => {
  const org = organization();
  Organization.findById.mockResolvedValue(org);
  const error = Object.assign(new Error("GitHub unavailable"), { status: 503 });
  githubApp.octokit.request.mockRejectedValue(error);
  const next = jest.fn();

  await getGitHubStatus({ params: { organizationId: "org-1" } }, response(), next);

  expect(org.githubInstallationId).toBe("10");
  expect(org.save).not.toHaveBeenCalled();
  expect(next).toHaveBeenCalledWith(error);
});

test("a live installation keeps its GitHub account details", async () => {
  const org = organization();
  Organization.findById.mockResolvedValue(org);
  githubApp.octokit.request.mockResolvedValue({ data: {
    id: 10, account: { login: "securepatch-team", type: "Organization" },
    html_url: "https://github.com/settings/installations/10",
  } });
  const res = response();

  await getGitHubStatus({ params: { organizationId: "org-1" } }, res, jest.fn());

  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
    data: { connected: true, installation: {
      id: 10, account: "securepatch-team", accountType: "Organization",
      htmlUrl: "https://github.com/settings/installations/10",
    } },
  }));
});

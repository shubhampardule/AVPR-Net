const organizationId = "org-1";

const models = [
  "Organization", "OrganizationMember", "OrganizationInvitation", "RepositoryAutomation",
  "Scan", "Finding", "AuditEvent", "RemediationVerification",
];
for (const name of models) {
  jest.mock(`../src/models/${name}`, () => ({
    findById: jest.fn(), find: jest.fn(), countDocuments: jest.fn(),
  }));
}

const Organization = require("../src/models/Organization");
const OrganizationMember = require("../src/models/OrganizationMember");
const OrganizationInvitation = require("../src/models/OrganizationInvitation");
const RepositoryAutomation = require("../src/models/RepositoryAutomation");
const Scan = require("../src/models/Scan");
const Finding = require("../src/models/Finding");
const AuditEvent = require("../src/models/AuditEvent");
const RemediationVerification = require("../src/models/RemediationVerification");
const { buildOrganizationExport, MAX_EXPORT_RECORDS } = require("../src/services/organization-export.service");

function query(value) {
  const chain = {
    select: jest.fn(() => chain),
    populate: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    lean: jest.fn().mockResolvedValue(value),
  };
  return chain;
}

function setup({ counts = {}, rows = {} } = {}) {
  Organization.findById.mockReturnValue(query({ _id: organizationId, name: "Team", slug: "team", status: "active" }));
  const entries = [
    [OrganizationMember, "members"], [OrganizationInvitation, "invitations"], [RepositoryAutomation, "automations"],
    [Scan, "scans"], [Finding, "findings"], [AuditEvent, "auditEvents"], [RemediationVerification, "verifications"],
  ];
  for (const [model, key] of entries) {
    model.countDocuments.mockResolvedValue(counts[key] || 0);
    model.find.mockReturnValue(query(rows[key] || []));
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  setup();
});

test("exports organization records while excluding credentials, installation IDs, source snippets, and raw stderr", async () => {
  const memberId = "member-1";
  setup({ rows: {
    members: [{ _id: memberId, user: { _id: "user-1", name: "Reviewer", email: "reviewer@example.test", githubUsername: "reviewer", githubId: "provider-secret" }, role: "owner", status: "active" }],
    invitations: [{ _id: "invite-1", email: "new@example.test", tokenHash: "invite-token-hash", role: "developer", status: "pending" }],
    automations: [{ _id: "auto-1", owner: "team", repo: "app", installationId: "install-secret", frequency: "weekly" }],
    scans: [{ _id: "scan-1", owner: "team", repo: "app", status: "completed", installationId: "install-secret", leaseToken: "worker-secret", scannerErrors: [{ scanner: "semgrep", exitCode: 2, stderr: "raw source secret" }] }],
    findings: [{ _id: "finding-1", scan: "scan-1", title: "Unsafe query", evidenceSnippet: "password = 'source-secret'", provenance: [{ code: "source-secret" }], status: "dismissed", statusReason: "Reviewed", reviewHistory: [{ status: "dismissed", reason: "Reviewed", reviewedBy: "user-1" }] }],
    auditEvents: [{ _id: "event-1", actor: "user-1", actorLabel: "User user-1", action: "github.installation_connected", details: { installationId: "install-secret", account: "team" } }],
    verifications: [{ _id: "verify-1", patchSha256: "a".repeat(64), sourceSha256: "b".repeat(64), patch: "source-secret" }],
  } });

  const exported = await buildOrganizationExport(organizationId);
  const serialized = JSON.stringify(exported);

  expect(exported.format).toBe("securepatch-organization-export");
  expect(exported.counts.total).toBe(7);
  expect(exported.data.members[0].user).toEqual({ id: "user-1", name: "Reviewer", email: "reviewer@example.test", githubUsername: "reviewer" });
  expect(exported.data.invitations[0]).not.toHaveProperty("tokenHash");
  expect(exported.data.scans[0]).not.toHaveProperty("leaseToken");
  expect(exported.data.scans[0].scannerErrors).toEqual([{ scanner: "semgrep", exitCode: 2 }]);
  expect(exported.data.findings[0]).not.toHaveProperty("evidenceSnippet");
  expect(exported.data.findings[0]).not.toHaveProperty("provenance");
  expect(exported.data.auditEvents[0].details).toEqual({ account: "team" });
  expect(serialized).not.toContain("install-secret");
  expect(serialized).not.toContain("worker-secret");
  expect(serialized).not.toContain("source-secret");
  expect(serialized).not.toContain("provider-secret");

  for (const model of [OrganizationMember, OrganizationInvitation, RepositoryAutomation, Scan, Finding, AuditEvent, RemediationVerification]) {
    expect(model.find).toHaveBeenCalledWith({ organization: organizationId });
  }
});

test("rejects oversized exports before loading record collections", async () => {
  OrganizationMember.countDocuments.mockResolvedValue(MAX_EXPORT_RECORDS + 1);

  await expect(buildOrganizationExport(organizationId)).rejects.toMatchObject({
    statusCode: 413,
    code: "EXPORT_LIMIT_EXCEEDED",
  });
  for (const model of [OrganizationMember, OrganizationInvitation, RepositoryAutomation, Scan, Finding, AuditEvent, RemediationVerification]) {
    expect(model.find).not.toHaveBeenCalled();
  }
});

test("returns null when the requested organization no longer exists", async () => {
  Organization.findById.mockReturnValue(query(null));
  await expect(buildOrganizationExport(organizationId)).resolves.toBeNull();
  expect(OrganizationMember.countDocuments).not.toHaveBeenCalled();
});

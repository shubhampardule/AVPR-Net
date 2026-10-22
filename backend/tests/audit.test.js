jest.mock("../src/models/AuditEvent", () => ({ create: jest.fn() }));

const AuditEvent = require("../src/models/AuditEvent");
const { recordAuditEvent, safeDetails } = require("../src/services/audit.service");

beforeEach(() => jest.clearAllMocks());

test("audit entries keep only action-specific metadata and record the actor and request", async () => {
  const event = { _id: "event-1" };
  AuditEvent.create.mockResolvedValue(event);
  const req = {
    params: { organizationId: "org-1" },
    user: { _id: "user-1", name: "Reviewer" },
    requestId: "request-1",
    res: { setHeader: jest.fn() },
  };

  await expect(recordAuditEvent(req, {
    action: "finding.reviewed",
    target: "finding/finding-1",
    details: { repository: "team/project", findingId: "finding-1", status: "dismissed", reason: "contains sensitive text", source: "secret source code" },
  })).resolves.toBe(event);

  expect(AuditEvent.create).toHaveBeenCalledWith({
    organization: "org-1",
    actor: "user-1",
    actorLabel: "User user-1",
    action: "finding.reviewed",
    target: "finding/finding-1",
    details: { repository: "team/project", findingId: "finding-1", status: "dismissed" },
    requestId: "request-1",
  });
  expect(req.res.setHeader).toHaveBeenCalledWith("X-SecurePatch-Audit-Recorded", "true");
});

test("audit details drop unknown values, strip control characters, and bound strings", () => {
  const details = safeDetails("scan.started", {
    repository: `team/project\n${"x".repeat(600)}`,
    includeDependencies: true,
    sourceCode: "never recorded",
  });
  expect(Object.keys(details)).toEqual(["repository", "includeDependencies"]);
  expect(details.repository).toHaveLength(500);
  expect(details.repository).not.toContain("\n");
  expect(details.includeDependencies).toBe(true);
});

test("ownership-transfer audit metadata identifies both accounts without collecting extra details", () => {
  expect(safeDetails("member.ownership_transferred", {
    previousOwnerId: "user-old", newOwnerId: "user-new", email: "private@example.com",
  })).toEqual({ previousOwnerId: "user-old", newOwnerId: "user-new" });
  expect(safeDetails("member.left", { memberId: "user-old", previousRole: "developer", email: "private@example.com" }))
    .toEqual({ memberId: "user-old", previousRole: "developer" });
});

test("organization export audit metadata records only the exported record count", () => {
  expect(safeDetails("organization.exported", { recordCount: 42, email: "private@example.com", source: "sensitive" }))
    .toEqual({ recordCount: 42 });
});

test("audit database errors are surfaced without changing the completed action response", async () => {
  AuditEvent.create.mockRejectedValue(new Error("database detail"));
  const req = { params: { organizationId: "org-1" }, user: { _id: "user-1" }, res: { setHeader: jest.fn() } };
  await expect(recordAuditEvent(req, { action: "scan.cancelled", target: "scan/scan-1", details: { scanId: "scan-1" } })).resolves.toBeNull();
  expect(req.res.setHeader).toHaveBeenCalledWith("X-SecurePatch-Audit-Recorded", "false");
});

jest.mock("../src/services/organization-export.service", () => ({
  buildOrganizationExport: jest.fn(),
}));
jest.mock("../src/services/audit.service", () => ({
  recordAuditEvent: jest.fn().mockResolvedValue({ _id: "audit-1" }),
}));

const { buildOrganizationExport } = require("../src/services/organization-export.service");
const { recordAuditEvent } = require("../src/services/audit.service");
const { exportOrganization } = require("../src/controllers/organization.controller");

beforeEach(() => jest.clearAllMocks());

function response() {
  const res = {
    setHeader: jest.fn(),
    type: jest.fn(),
    send: jest.fn(),
    status: jest.fn(),
    json: jest.fn(),
  };
  res.type.mockReturnValue(res);
  res.status.mockReturnValue(res);
  return res;
}

test("sends the complete export as an attachment and audits its record count", async () => {
  const exported = {
    format: "securepatch-organization-export",
    organization: { slug: "team-name" },
    counts: { total: 12 },
    data: { scans: [], findings: [] },
  };
  buildOrganizationExport.mockResolvedValue(exported);
  const req = { params: { organizationId: "org-1" }, requestId: "request-1", user: { _id: "user-1" } };
  const res = response();

  await exportOrganization(req, res, jest.fn());

  expect(recordAuditEvent).toHaveBeenCalledWith(req, {
    action: "organization.exported", target: "organization/org-1", details: { recordCount: 12 },
  });
  expect(res.setHeader).toHaveBeenCalledWith("Content-Disposition", expect.stringMatching(/^attachment; filename="securepatch-team-name-export-\d{4}-\d{2}-\d{2}\.json"$/));
  expect(res.type).toHaveBeenCalledWith("application/json");
  expect(res.send).toHaveBeenCalledWith(JSON.stringify(exported, null, 2));
});

test("returns a not-found response when the organization disappears", async () => {
  buildOrganizationExport.mockResolvedValue(null);
  const req = { params: { organizationId: "org-1" } };
  const res = response();

  await exportOrganization(req, res, jest.fn());

  expect(res.status).toHaveBeenCalledWith(404);
  expect(res.json).toHaveBeenCalledWith({ success: false, error: { code: "ORGANIZATION_NOT_FOUND", message: "Organization not found" } });
  expect(recordAuditEvent).not.toHaveBeenCalled();
});

test("forwards export failures to the API error handler without creating an audit event", async () => {
  const error = Object.assign(new Error("export limit"), { code: "EXPORT_LIMIT_EXCEEDED", statusCode: 413 });
  buildOrganizationExport.mockRejectedValue(error);
  const next = jest.fn();
  await exportOrganization({ params: { organizationId: "org-1" } }, response(), next);
  expect(next).toHaveBeenCalledWith(error);
  expect(recordAuditEvent).not.toHaveBeenCalled();
});

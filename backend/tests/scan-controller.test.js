jest.mock("../src/services/scan.service", () => ({ enqueueScan: jest.fn() }));
jest.mock("../src/services/audit.service", () => ({ recordAuditEvent: jest.fn().mockResolvedValue(null) }));

const ScanService = require("../src/services/scan.service");
const { recordAuditEvent } = require("../src/services/audit.service");
const { enqueueScan } = require("../src/controllers/scan.controller");

test("successful scan enqueue records the repository and immutable commit", async () => {
  ScanService.enqueueScan.mockResolvedValue({ scanId: "scan-1", status: "queued", owner: "team", repo: "project",
    branch: "main", commitSha: "a".repeat(40), includeDependencies: true });
  const req = { params: { organizationId: "org-1", owner: "team", repo: "project" }, body: { includeDependencies: true }, user: { _id: "user-1" } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

  await enqueueScan(req, res, jest.fn());

  expect(res.status).toHaveBeenCalledWith(202);
  expect(recordAuditEvent).toHaveBeenCalledWith(req, expect.objectContaining({
    action: "scan.started", target: "scan/scan-1",
    details: { repository: "team/project", scanId: "scan-1", branch: "main", commitSha: "a".repeat(40), includeDependencies: true },
  }));
});

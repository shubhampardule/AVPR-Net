jest.mock("../src/models/Scan", () => ({ findById: jest.fn(), findOneAndUpdate: jest.fn() }));
jest.mock("../src/models/Finding", () => ({ findOne: jest.fn(), findOneAndUpdate: jest.fn() }));
jest.mock("../src/middleware/auth.middleware", () => ({ requireAuth: (req, res, next) => { req.user = { _id: "actor-1" }; next(); } }));
jest.mock("../src/middleware/scanAccess.middleware", () => ({ requireScanMember: (req, res, next) => next() }));
jest.mock("../src/middleware/rbac.middleware", () => ({ requireRole: () => (req, res, next) => next() }));
jest.mock("../src/services/finding-workflow.service", () => ({}));
jest.mock("../src/services/remediation.service", () => ({ createPullRequest: jest.fn() }));
jest.mock("../src/services/audit.service", () => ({ recordAuditEvent: jest.fn().mockResolvedValue(null) }));

const express = require("express");
const request = require("supertest");
const Scan = require("../src/models/Scan");
const Finding = require("../src/models/Finding");
const remediation = require("../src/services/remediation.service");
const { recordAuditEvent } = require("../src/services/audit.service");
const scanRoutes = require("../src/routes/scan.routes");
const app = express();
app.use(express.json());
app.use("/scans", scanRoutes);

beforeEach(() => jest.clearAllMocks());

test("cancelling a scan appends a scoped audit event", async () => {
  const scan = { _id: "scan-1", organization: "org-1", owner: "team", repo: "project", status: "failed" };
  Scan.findOneAndUpdate.mockResolvedValue(scan);

  const response = await request(app).post("/scans/scan-1/cancel");

  expect(response.status).toBe(200);
  expect(recordAuditEvent).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({
    organizationId: "org-1", action: "scan.cancelled", target: "scan/scan-1",
    details: { repository: "team/project", scanId: "scan-1" },
  }));
});

test("a finding review appends the chosen decision without storing its free-text reason", async () => {
  const findingId = "507f1f77bcf86cd799439012";
  const finding = { _id: findingId, organization: "org-1", scan: "scan-1", owner: "team", repo: "project" };
  Finding.findOneAndUpdate.mockResolvedValue(finding);

  const response = await request(app).patch(`/scans/scan-1/findings/${findingId}`)
    .send({ status: "dismissed", reason: "Reviewed privately; do not log this text" });

  expect(response.status).toBe(200);
  expect(recordAuditEvent).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({
    organizationId: "org-1", action: "finding.reviewed", target: `finding/${findingId}`,
    details: { repository: "team/project", scanId: "scan-1", findingId, status: "dismissed" },
  }));
  expect(recordAuditEvent.mock.calls[0][1].details).not.toHaveProperty("reason");
});

test("draft pull request creation records the repository and reviewed base commit", async () => {
  const scanId = "507f1f77bcf86cd799439011", findingId = "507f1f77bcf86cd799439012";
  const scan = { _id: scanId, organization: "org-1", owner: "team", repo: "project", commitSha: "a".repeat(40) };
  const finding = { _id: findingId, organization: "org-1", scan: scanId, owner: "team", repo: "project" };
  Scan.findById.mockReturnValue({ lean: async () => scan });
  Finding.findOne.mockReturnValue({ lean: async () => finding });
  remediation.createPullRequest.mockResolvedValue({ number: 12, url: "https://github.com/team/project/pull/12", baseSha: "b".repeat(40), draft: true });

  const response = await request(app).post(`/scans/${scanId}/findings/${findingId}/pull-request`).send({ patch: "diff", acknowledged: true });

  expect(response.status).toBe(201);
  expect(recordAuditEvent).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({
    organizationId: "org-1", action: "pull_request.draft_created", target: "pull-request/team/project#12",
    details: { repository: "team/project", pullRequestNumber: 12,
      pullRequestUrl: "https://github.com/team/project/pull/12", baseSha: "b".repeat(40) },
  }));
});

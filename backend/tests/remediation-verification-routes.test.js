jest.mock("../src/models/Scan", () => ({ findById: jest.fn() }));
jest.mock("../src/models/Finding", () => ({ findOne: jest.fn() }));
jest.mock("../src/middleware/auth.middleware", () => ({ requireAuth: (req, res, next) => { req.user = { _id: "actor-1" }; next(); } }));
jest.mock("../src/middleware/scanAccess.middleware", () => ({ requireScanMember: (req, res, next) => next() }));
jest.mock("../src/middleware/rbac.middleware", () => ({ requireRole: () => (req, res, next) => next() }));
jest.mock("../src/services/finding-workflow.service", () => ({}));
jest.mock("../src/services/budget.service", () => ({ consume: jest.fn().mockResolvedValue(undefined) }));
jest.mock("../src/services/remediation.service", () => ({ validate: jest.fn(), createPullRequest: jest.fn() }));
jest.mock("../src/services/remediation-verification.service", () => ({ recordVerification: jest.fn(), recordFailedIntegrity: jest.fn(), listVerifications: jest.fn() }));
jest.mock("../src/services/audit.service", () => ({ recordAuditEvent: jest.fn().mockResolvedValue(null) }));
jest.mock("../src/config/logger", () => ({ error: jest.fn() }));

const express = require("express");
const request = require("supertest");
const Scan = require("../src/models/Scan");
const Finding = require("../src/models/Finding");
const remediation = require("../src/services/remediation.service");
const budget = require("../src/services/budget.service");
const verification = require("../src/services/remediation-verification.service");
const scanRoutes = require("../src/routes/scan.routes");
const errorHandler = require("../src/middleware/errorHandler");

const scanId = "507f1f77bcf86cd799439011";
const findingId = "507f1f77bcf86cd799439012";
const scan = { _id: scanId, organization: "org-1", owner: "team", repo: "project", commitSha: "a".repeat(40) };
const finding = { _id: findingId, scan: scanId, organization: "org-1" };
const app = express();
app.use(express.json());
app.use("/scans", scanRoutes);
app.use(errorHandler);

beforeEach(() => {
  jest.clearAllMocks();
  Scan.findById.mockReturnValue({ lean: async () => scan });
  Finding.findOne.mockReturnValue({ lean: async () => finding });
});

test("validation records the result and returns the append-only verification record", async () => {
  const validation = { context: { filePath: "src/index.js", originalCode: "const x=1;" }, content: "const x=2;", syntax: { status: "failed" } };
  const record = { _id: "verification-1", checks: [{ name: "syntax", status: "failed" }] };
  remediation.validate.mockResolvedValue(validation);
  verification.recordVerification.mockResolvedValue(record);

  const response = await request(app).post(`/scans/${scanId}/findings/${findingId}/validate`).send({ patch: "diff" });

  expect(response.status).toBe(200);
  expect(remediation.validate).toHaveBeenCalledWith(scan, finding, "diff", { allowSyntaxFailure: true });
  expect(budget.consume).toHaveBeenCalledWith("patch-validate:org-1", 60, 3600000);
  expect(verification.recordVerification).toHaveBeenCalledWith({ scan, finding, actorId: "actor-1", patch: "diff", validation, action: "validation" });
  expect(response.body.data).toMatchObject({ applies: true, syntax: { status: "failed" }, verification: record });
  expect(response.headers["x-securepatch-verification-recorded"]).toBe("true");
});

test("caps repeated patch validations per organization before creating more records", async () => {
  budget.consume.mockRejectedValueOnce(Object.assign(new Error("Usage limit reached"), { statusCode: 429, code: "USAGE_LIMIT" }));

  const response = await request(app).post(`/scans/${scanId}/findings/${findingId}/validate`).send({ patch: "diff" });

  expect(response.status).toBe(429);
  expect(remediation.validate).not.toHaveBeenCalled();
  expect(verification.recordVerification).not.toHaveBeenCalled();
});

test("a rejected diff writes a failed-integrity record before returning the validation error", async () => {
  const context = { filePath: "src/index.js", originalCode: "const x=1;" };
  remediation.validate.mockRejectedValue(Object.assign(new Error("Diff does not apply to the scanned source"), {
    statusCode: 409, code: "PATCH_INTEGRITY_FAILED", validationContext: context,
  }));
  verification.recordFailedIntegrity.mockResolvedValue({ _id: "failed-verification" });

  const response = await request(app).post(`/scans/${scanId}/findings/${findingId}/validate`).send({ patch: "bad diff" });

  expect(response.status).toBe(409);
  expect(verification.recordFailedIntegrity).toHaveBeenCalledWith({ scan, finding, actorId: "actor-1", patch: "bad diff", context });
  expect(response.headers["x-securepatch-verification-recorded"]).toBe("true");
});

test("verification history is scoped to the scan's organization and finding", async () => {
  const records = [{ _id: "verification-1" }];
  verification.listVerifications.mockResolvedValue(records);

  const response = await request(app).get(`/scans/${scanId}/findings/${findingId}/verifications`);

  expect(response.status).toBe(200);
  expect(verification.listVerifications).toHaveBeenCalledWith({ organizationId: "org-1", scanId, findingId, limit: 20 });
  expect(response.body.data.verifications).toEqual(records);
});

test("draft PR response reports when its verification record could not be saved after GitHub created the PR", async () => {
  const { verificationMaterial, ...publicResult } = { number: 12, url: "https://github.com/team/project/pull/12", draft: true,
    verificationMaterial: { context: { originalCode: "must not leak" }, content: "must not leak" } };
  remediation.createPullRequest.mockResolvedValue({ ...publicResult, verificationMaterial });
  verification.recordVerification.mockRejectedValue(new Error("database unavailable"));

  const response = await request(app).post(`/scans/${scanId}/findings/${findingId}/pull-request`).send({ patch: "diff", acknowledged: true });

  expect(response.status).toBe(201);
  expect(response.headers["x-securepatch-verification-recorded"]).toBe("false");
  expect(response.body.data).toMatchObject({ number: 12, verification: null, verificationRecorded: false });
  expect(JSON.stringify(response.body)).not.toContain("must not leak");
});

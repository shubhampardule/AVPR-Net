jest.mock("../src/models/Scan", () => ({ aggregate: jest.fn(), findById: jest.fn(), findOneAndUpdate: jest.fn() }));
jest.mock("../src/models/Finding", () => ({ find: jest.fn(), countDocuments: jest.fn(), findOne: jest.fn(), findOneAndUpdate: jest.fn() }));
jest.mock("../src/middleware/auth.middleware", () => ({ requireAuth: (req, res, next) => { req.user = { _id: "actor-1" }; next(); } }));
jest.mock("../src/middleware/organization.middleware", () => ({ requireOrganizationMember: (req, res, next) => next() }));
jest.mock("../src/middleware/scanAccess.middleware", () => ({ requireScanMember: (req, res, next) => next() }));
jest.mock("../src/middleware/rbac.middleware", () => ({ requireRole: () => (req, res, next) => next() }));
jest.mock("../src/services/finding-workflow.service", () => ({}));
jest.mock("../src/services/remediation.service", () => ({}));
jest.mock("../src/services/audit.service", () => ({ recordAuditEvent: jest.fn() }));

const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const Scan = require("../src/models/Scan");
const Finding = require("../src/models/Finding");
const scanRoutes = require("../src/routes/scan.routes");
const app = express();
app.use(express.json());
app.use("/scans", scanRoutes);
const organizationId = "507f1f77bcf86cd799439011";

function findingQuery(findings) {
  const query = {};
  for (const method of ["populate", "sort", "skip", "limit"]) query[method] = jest.fn(() => query);
  query.lean = jest.fn().mockResolvedValue(findings);
  return query;
}

beforeEach(() => jest.clearAllMocks());

test("organization findings use complete scan baselines and explain stale or missing baselines", async () => {
  const baselineQuery = [
    { _id: { owner: "team", repo: "partial" }, scan: "scan-partial-baseline", commitSha: "a".repeat(40) },
    { _id: { owner: "team", repo: "complete" }, scan: "scan-complete", commitSha: "c".repeat(40) },
  ];
  const activityQuery = [
    { _id: { owner: "team", repo: "partial" }, scan: "scan-partial-new", status: "completed" },
    { _id: { owner: "team", repo: "failed" }, scan: "scan-failed", status: "failed" },
    { _id: { owner: "team", repo: "complete" }, scan: "scan-complete", status: "completed" },
  ];
  Scan.aggregate.mockResolvedValueOnce(baselineQuery).mockResolvedValueOnce(activityQuery);
  const query = findingQuery([{ _id: "finding-1", scan: "scan-partial-baseline" }]);
  Finding.find.mockReturnValue(query);
  Finding.countDocuments.mockResolvedValue(1);

  const response = await request(app).get(`/scans/organizations/${organizationId}/findings?page=2&limit=10&riskCategory=high`);

  expect(response.status).toBe(200);
  expect(Scan.aggregate).toHaveBeenNthCalledWith(1, expect.arrayContaining([
    { $match: { organization: new mongoose.Types.ObjectId(organizationId), status: "completed", scannersUsed: { $exists: true, $ne: [] }, scannerErrors: { $size: 0 } } },
    { $sort: { createdAt: -1, _id: -1 } },
  ]));
  expect(Finding.find).toHaveBeenCalledWith({ organization: organizationId,
    scan: { $in: ["scan-partial-baseline", "scan-complete"] }, status: { $nin: ["resolved", "dismissed"] }, riskCategory: "high" });
  expect(query.skip).toHaveBeenCalledWith(10);
  expect(response.body.data.latestFindingsFreshness).toEqual({
    repositoriesWithSuccessfulBaseline: 2,
    repositoriesUsingEarlierSuccessfulResult: 1,
    repositoriesWithoutSuccessfulBaseline: 1,
  });
});

test("organization findings never turn a repository without any complete scan into a clean result", async () => {
  Scan.aggregate.mockResolvedValueOnce([]).mockResolvedValueOnce([
    { _id: { owner: "team", repo: "failed" }, scan: "scan-failed", status: "failed" },
  ]);
  const query = findingQuery([]);
  Finding.find.mockReturnValue(query);
  Finding.countDocuments.mockResolvedValue(0);

  const response = await request(app).get(`/scans/organizations/${organizationId}/findings`);

  expect(response.status).toBe(200);
  expect(Finding.find).toHaveBeenCalledWith(expect.objectContaining({ scan: { $in: [] } }));
  expect(response.body.data.latestFindingsFreshness).toEqual({
    repositoriesWithSuccessfulBaseline: 0,
    repositoriesUsingEarlierSuccessfulResult: 0,
    repositoriesWithoutSuccessfulBaseline: 1,
  });
});

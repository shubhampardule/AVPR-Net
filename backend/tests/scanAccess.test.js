jest.mock("../src/models/Scan", () => ({ findById: jest.fn() }));
jest.mock("../src/models/OrganizationMember", () => ({ findOne: jest.fn() }));
jest.mock("../src/models/Organization", () => ({ exists: jest.fn(async () => true) }));
const express = require("express");
const request = require("supertest");
const Scan = require("../src/models/Scan");
const OrganizationMember = require("../src/models/OrganizationMember");
const { requireScanMember } = require("../src/middleware/scanAccess.middleware");
const scanId = "507f1f77bcf86cd799439011";
const app = express();
app.use((req, res, next) => { req.user = { _id: "other-user" }; next(); });
app.get("/scans/:scanId", requireScanMember, (req, res) => res.json({ status: "completed" }));
app.get("/scans/:scanId/findings", requireScanMember, (req, res) => res.json({ findings: [] }));
beforeEach(() => jest.clearAllMocks());

test.each(["", "/findings"])("another organization's scan%s is inaccessible", async (suffix) => {
  Scan.findById.mockResolvedValue({ organization: "private-org" });
  OrganizationMember.findOne.mockResolvedValue(null);
  const response = await request(app).get(`/scans/${scanId}${suffix}`);
  expect(response.statusCode).toBe(404);
  expect(response.body.error.code).toBe("SCAN_NOT_FOUND");
  expect(OrganizationMember.findOne).toHaveBeenCalledWith({ user: "other-user", organization: "private-org", status: "active" });
});

test("active organization members can load scan findings", async () => {
  Scan.findById.mockResolvedValue({ organization: "member-org" });
  OrganizationMember.findOne.mockResolvedValue({ role: "developer" });
  expect((await request(app).get(`/scans/${scanId}/findings`)).statusCode).toBe(200);
});

test("invalid scan identifiers return not found without querying MongoDB", async () => {
  expect((await request(app).get("/scans/invalid")).statusCode).toBe(404);
  expect(Scan.findById).not.toHaveBeenCalled();
});

jest.mock("../src/controllers/organization.controller", () => ({
  createOrganization: jest.fn(), getMyOrganizations: jest.fn(), getOrganization: jest.fn(),
  getAiSettings: jest.fn(), updateAiSettings: jest.fn(),
  exportOrganization: jest.fn((req, res) => res.json({ success: true, data: { exported: true } })),
}));
jest.mock("../src/middleware/auth.middleware", () => ({ requireAuth: (req, res, next) => { req.user = { _id: "user-1" }; next(); } }));
jest.mock("../src/middleware/organization.middleware", () => ({ requireOrganizationMember: (req, res, next) => {
  req.organizationMembership = { role: req.headers["x-fixture-role"] || "owner" }; next();
} }));

const express = require("express");
const request = require("supertest");
const { exportOrganization } = require("../src/controllers/organization.controller");
const routes = require("../src/routes/organization.routes");

const app = express();
app.use("/organizations", routes);

beforeEach(() => jest.clearAllMocks());

test("organization export is available to owners and admins only", async () => {
  const denied = await request(app).get("/organizations/org-1/export").set("x-fixture-role", "developer");
  expect(denied.status).toBe(403);
  expect(exportOrganization).not.toHaveBeenCalled();

  const owner = await request(app).get("/organizations/org-1/export").set("x-fixture-role", "owner");
  expect(owner.status).toBe(200);
  const admin = await request(app).get("/organizations/org-1/export").set("x-fixture-role", "admin");
  expect(admin.status).toBe(200);
  expect(exportOrganization).toHaveBeenCalledTimes(2);
});

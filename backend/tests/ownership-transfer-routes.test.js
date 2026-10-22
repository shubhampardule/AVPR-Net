jest.mock("../src/controllers/member.controller", () => ({
  getMembers: jest.fn(), updateMemberRole: jest.fn(), removeMember: jest.fn(),
  transferOwnership: jest.fn((req, res) => res.json({ success: true, data: { transferred: true } })),
  leaveOrganization: jest.fn((req, res) => res.json({ success: true, data: { left: true } })),
}));
jest.mock("../src/controllers/invitation.controller", () => ({
  createInvitation: jest.fn(), listInvitations: jest.fn(), revokeInvitation: jest.fn(), acceptInvitation: jest.fn(),
}));
jest.mock("../src/middleware/auth.middleware", () => ({ requireAuth: (req, res, next) => { req.user = { _id: "owner-1" }; next(); } }));
jest.mock("../src/middleware/organization.middleware", () => ({ requireOrganizationMember: (req, res, next) => {
  req.organizationMembership = { _id: "membership-1", role: req.headers["x-fixture-role"] || "owner" }; next();
} }));

const express = require("express");
const request = require("supertest");
const { transferOwnership, leaveOrganization } = require("../src/controllers/member.controller");
const routes = require("../src/routes/member.routes");

const app = express();
app.use(express.json());
app.use("/organizations", routes);

beforeEach(() => jest.clearAllMocks());

test("only the current organization owner can reach the ownership transfer action", async () => {
  const denied = await request(app).post("/organizations/org-1/ownership-transfer").set("x-fixture-role", "admin").send({});
  expect(denied.status).toBe(403);
  expect(transferOwnership).not.toHaveBeenCalled();

  const accepted = await request(app).post("/organizations/org-1/ownership-transfer").set("x-fixture-role", "owner")
    .send({ newOwnerId: "member-2", confirmation: "Example" });
  expect(accepted.status).toBe(200);
  expect(transferOwnership).toHaveBeenCalledTimes(1);
});

test("a developer can reach only their own leave-membership route", async () => {
  const denied = await request(app).delete("/organizations/org-1/members/member-2").set("x-fixture-role", "developer");
  expect(denied.status).toBe(403);
  expect(leaveOrganization).not.toHaveBeenCalled();

  const leave = await request(app).delete("/organizations/org-1/members/me").set("x-fixture-role", "developer");
  expect(leave.status).toBe(200);
  expect(leaveOrganization).toHaveBeenCalledTimes(1);
});

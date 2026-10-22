jest.mock("../src/models/AuditEvent", () => ({ find: jest.fn(), countDocuments: jest.fn() }));
jest.mock("../src/middleware/auth.middleware", () => ({ requireAuth: (req, res, next) => { req.user = { _id: "actor-1" }; next(); } }));
jest.mock("../src/middleware/organization.middleware", () => ({ requireOrganizationMember: (req, res, next) => {
  req.organizationMembership = { role: req.get("x-test-role") || "owner" }; next();
} }));
jest.mock("../src/middleware/rbac.middleware", () => ({ requireRole: (...roles) => (req, res, next) =>
  roles.includes(req.organizationMembership?.role) ? next() : res.status(403).json({ error: { code: "INSUFFICIENT_PERMISSIONS" } }) }));

const express = require("express");
const request = require("supertest");
const AuditEvent = require("../src/models/AuditEvent");
const memberRoutes = require("../src/routes/member.routes");

function queryWith(events) {
  const chain = {};
  for (const method of ["select", "populate", "sort", "skip", "limit"]) chain[method] = jest.fn(() => chain);
  chain.lean = jest.fn().mockResolvedValue(events);
  return chain;
}

beforeEach(() => jest.clearAllMocks());

test("owner and admin activity reads are organization-scoped and paginated", async () => {
  const query = queryWith([{ _id: "event-1", action: "scan.started", target: "scan/1", actorLabel: "Stored label",
    actor: { name: "Current name" }, details: { repository: "team/project" }, createdAt: new Date("2026-10-21T10:00:00Z") }]);
  AuditEvent.find.mockReturnValue(query);
  AuditEvent.countDocuments.mockResolvedValue(21);
  const app = express(); app.use(express.json()); app.use("/organizations", memberRoutes);

  const response = await request(app).get("/organizations/org-1/audit-events?page=2&limit=10");

  expect(response.status).toBe(200);
  expect(AuditEvent.find).toHaveBeenCalledWith({ organization: "org-1" });
  expect(query.skip).toHaveBeenCalledWith(10);
  expect(query.limit).toHaveBeenCalledWith(10);
  expect(AuditEvent.countDocuments).toHaveBeenCalledWith({ organization: "org-1" });
  expect(response.body.data.events[0].actorLabel).toBe("Current name");
  expect(response.body.data.pagination).toEqual({ page: 2, limit: 10, total: 21, totalPages: 3 });
});

test("developers cannot read the organization security activity log", async () => {
  const app = express(); app.use("/organizations", memberRoutes);
  const response = await request(app).get("/organizations/org-1/audit-events").set("x-test-role", "developer");
  expect(response.status).toBe(403);
  expect(AuditEvent.find).not.toHaveBeenCalled();
});

test("activity pagination rejects oversized page sizes", async () => {
  const app = express(); app.use("/organizations", memberRoutes);
  const response = await request(app).get("/organizations/org-1/audit-events?limit=101");
  expect(response.status).toBe(400);
  expect(AuditEvent.find).not.toHaveBeenCalled();
});

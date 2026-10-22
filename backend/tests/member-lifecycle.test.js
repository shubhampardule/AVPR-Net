const Membership = require("../src/models/OrganizationMember");
const mongoose = require("mongoose");
jest.mock("../src/services/audit.service", () => ({ recordAuditEvent: jest.fn().mockResolvedValue(null) }));
const { removeMember, updateMemberRole, leaveOrganization } = require("../src/controllers/member.controller");
const { recordAuditEvent } = require("../src/services/audit.service");
const member = () => new Membership({ user: "000000000000000000000001", organization: "000000000000000000000002", role: "developer" });
const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
beforeEach(() => { jest.restoreAllMocks(); recordAuditEvent.mockClear(); recordAuditEvent.mockResolvedValue(null); });
test("revocation saves a schema-valid non-active status", async () => {
  const document = member();
  jest.spyOn(Membership, "findOne").mockResolvedValue(document);
  jest.spyOn(document, "save").mockImplementation(() => document.validate());
  const next = jest.fn(), res = response();
  await removeMember({ params: { organizationId: document.organization, userId: document.user } }, res, next);
  expect(next).not.toHaveBeenCalled(); expect(document.status).toBe("suspended");
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  expect(recordAuditEvent).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ action: "member.removed" }));
});
test("owner membership is protected from removal", async () => {
  const document = member(); document.role = "owner";
  jest.spyOn(Membership, "findOne").mockResolvedValue(document);
  const res = response();
  await removeMember({ params: {} }, res, jest.fn());
  expect(res.status).toHaveBeenCalledWith(403); expect(document.status).toBe("active");
});
test("role changes are recorded with old and new roles", async () => {
  const document = member();
  jest.spyOn(document, "save").mockImplementation(() => document.validate());
  jest.spyOn(Membership, "findOne").mockResolvedValue(document);
  const req = { params: { organizationId: document.organization, userId: document.user }, body: { role: "admin" }, user: { _id: "owner-1" } };
  await updateMemberRole(req, response(), jest.fn());
  expect(document.role).toBe("admin");
  expect(recordAuditEvent).toHaveBeenCalledWith(req, expect.objectContaining({ action: "member.role_changed",
    details: { memberId: String(document.user), fromRole: "developer", toRole: "admin" } }));
});

test("a non-owner can leave while an active owner remains and the exit is audited", async () => {
  const actorId = "000000000000000000000011";
  const organizationId = "000000000000000000000022";
  const departed = member();
  const ownerQuery = { session: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue({ _id: "owner-id" }) };
  jest.spyOn(mongoose.connection, "transaction").mockImplementation(callback => callback({ id: "session-1" }));
  jest.spyOn(Membership, "findOneAndUpdate").mockResolvedValue(departed);
  jest.spyOn(Membership, "findOne").mockReturnValue(ownerQuery);
  const req = { params: { organizationId }, user: { _id: actorId }, organizationMembership: { _id: "membership-1", role: "developer" } };
  const res = response();

  await leaveOrganization(req, res, jest.fn());

  expect(Membership.findOneAndUpdate).toHaveBeenCalledWith({
    _id: "membership-1", user: actorId, organization: organizationId, status: "active", role: { $in: ["admin", "developer"] },
  }, { $set: { status: "suspended" } }, { session: { id: "session-1" }, returnDocument: "after", runValidators: true });
  expect(ownerQuery.session).toHaveBeenCalledWith({ id: "session-1" });
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, message: "You left the organization" }));
  expect(recordAuditEvent).toHaveBeenCalledWith(req, expect.objectContaining({ action: "member.left", details: { memberId: actorId, previousRole: "developer" } }));
});

test("an owner must transfer ownership before leaving", async () => {
  jest.spyOn(mongoose.connection, "transaction");
  jest.spyOn(Membership, "findOneAndUpdate");
  const req = { params: { organizationId: "org-1" }, user: { _id: "owner-1" }, organizationMembership: { _id: "owner-membership", role: "owner" } };
  const next = jest.fn();

  await leaveOrganization(req, response(), next);

  expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409, code: "OWNER_MUST_TRANSFER" }));
  expect(mongoose.connection.transaction).not.toHaveBeenCalled();
  expect(Membership.findOneAndUpdate).not.toHaveBeenCalled();
});

test("a member cannot leave when the organization has no active owner", async () => {
  const ownerQuery = { session: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(null) };
  jest.spyOn(mongoose.connection, "transaction").mockImplementation(callback => callback({ id: "session-2" }));
  jest.spyOn(Membership, "findOneAndUpdate").mockResolvedValue(member());
  jest.spyOn(Membership, "findOne").mockReturnValue(ownerQuery);
  const next = jest.fn();
  const req = { params: { organizationId: "org-1" }, user: { _id: "member-1" }, organizationMembership: { _id: "membership-1", role: "developer" } };

  await leaveOrganization(req, response(), next);

  expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409, code: "ACTIVE_OWNER_REQUIRED" }));
  expect(recordAuditEvent).not.toHaveBeenCalled();
});

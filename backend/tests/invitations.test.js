jest.mock("../src/models/Organization", () => ({ findOne: jest.fn() }));
jest.mock("../src/models/User", () => ({ findOne: jest.fn() }));
jest.mock("../src/models/OrganizationInvitation", () => ({
  create: jest.fn(), findOne: jest.fn(), countDocuments: jest.fn(),
}));
jest.mock("../src/models/OrganizationMember", () => {
  const Model = jest.fn().mockImplementation(function (fields) {
    Object.assign(this, fields);
    this.save = jest.fn().mockResolvedValue(this);
  });
  Model.findOne = jest.fn();
  return Model;
});

const crypto = require("node:crypto");
const mongoose = require("mongoose");
const Organization = require("../src/models/Organization");
const OrganizationInvitation = require("../src/models/OrganizationInvitation");
const OrganizationMember = require("../src/models/OrganizationMember");
const User = require("../src/models/User");
const { createInvitation, acceptInvitation, revokeInvitation } = require("../src/controllers/invitation.controller");

const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
const inviter = { _id: "inviter-id", email: "owner@example.test" };
const organizationId = "507f1f77bcf86cd799439011";

beforeEach(() => {
  jest.clearAllMocks();
  process.env.FRONTEND_URL = "https://securepatch.example";
});

test("creates an email-bound invitation and stores only a hash of its random token", async () => {
  User.findOne.mockResolvedValue(null);
  OrganizationInvitation.countDocuments.mockResolvedValue(0);
  OrganizationInvitation.findOne.mockResolvedValue(null);
  OrganizationInvitation.create.mockImplementation(async (document) => ({ _id: "invite-id", ...document }));
  const res = response(), next = jest.fn();

  await createInvitation({ params: { organizationId }, body: { email: "  New.Member@Example.Test ", role: "developer" }, user: inviter, organizationMembership: { role: "owner" } }, res, next);

  expect(next).not.toHaveBeenCalled();
  const payload = res.json.mock.calls[0][0].data.invitation;
  expect(payload.email).toBe("new.member@example.test");
  expect(payload.url).toMatch(/^https:\/\/securepatch\.example\/invite\/accept\?token=/);
  const token = new URL(payload.url).searchParams.get("token");
  const stored = OrganizationInvitation.create.mock.calls[0][0];
  expect(token).toHaveLength(43);
  expect(stored.tokenHash).toBe(crypto.createHash("sha256").update(token).digest("hex"));
  expect(stored.tokenHash).not.toContain(token);
  expect(stored.expiresAt.getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000);
});

test("rejects malformed email and unsupported privilege before creating an invitation", async () => {
  const res = response();
  await createInvitation({ params: { organizationId }, body: { email: "nope", role: "owner" }, user: inviter }, res, jest.fn());
  expect(res.status).toHaveBeenCalledWith(400);
  expect(OrganizationInvitation.create).not.toHaveBeenCalled();
});

test("admins cannot grant admin access through an invitation", async () => {
  const res = response();
  await createInvitation({
    params: { organizationId }, body: { email: "new@example.test", role: "admin" },
    user: inviter, organizationMembership: { role: "admin" },
  }, res, jest.fn());
  expect(res.status).toHaveBeenCalledWith(403);
  expect(OrganizationInvitation.create).not.toHaveBeenCalled();
});

test("invitation acceptance requires the exact verified account email and leaves the token unused on mismatch", async () => {
  const invitation = { email: "right@example.test", organization: organizationId, role: "developer", save: jest.fn() };
  const query = { session: jest.fn().mockResolvedValue(invitation) };
  OrganizationInvitation.findOne.mockReturnValue(query);
  jest.spyOn(mongoose.connection, "transaction").mockImplementation((callback) => callback({ id: "session" }));
  const token = "a".repeat(43), res = response(), next = jest.fn();

  await acceptInvitation({ body: { token }, user: { _id: "wrong-user", email: "wrong@example.test", status: "active" } }, res, next);

  expect(res.status).toHaveBeenCalledWith(403);
  expect(res.json.mock.calls[0][0].error.code).toBe("INVITATION_EMAIL_MISMATCH");
  expect(OrganizationMember.findOne).not.toHaveBeenCalled();
  expect(invitation.save).not.toHaveBeenCalled();
  expect(next).not.toHaveBeenCalled();
});

test("acceptance atomically activates the invited role and consumes the invitation", async () => {
  const invitation = {
    _id: "invite-id", email: "new.member@example.test", organization: organizationId, role: "admin",
    status: "pending", tokenHash: "stored-hash", save: jest.fn().mockResolvedValue(),
  };
  OrganizationInvitation.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue(invitation) });
  Organization.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue({ _id: organizationId, name: "Team", slug: "team" }) });
  OrganizationMember.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue(null) });
  jest.spyOn(mongoose.connection, "transaction").mockImplementation((callback) => callback({ id: "session" }));
  const res = response(), next = jest.fn();

  await acceptInvitation({ body: { token: "a".repeat(43) }, user: { _id: "new-user", email: "NEW.MEMBER@example.test", status: "active" } }, res, next);

  expect(next).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json.mock.calls[0][0].data).toEqual({ organization: { id: organizationId, name: "Team", slug: "team" }, role: "admin" });
  const membership = OrganizationMember.mock.instances.at(-1);
  expect(membership.status).toBe("active");
  expect(membership.role).toBe("admin");
  expect(membership.save).toHaveBeenCalledWith({ session: { id: "session" } });
  expect(invitation.status).toBe("accepted");
  expect(invitation.tokenHash).toBeUndefined();
  expect(invitation.save).toHaveBeenCalledWith({ session: { id: "session" } });
});

test("a valid invitation restores suspended membership only after acceptance", async () => {
  const invitation = {
    email: "new.member@example.test", organization: organizationId, role: "developer",
    status: "pending", save: jest.fn().mockResolvedValue(),
  };
  const suspendedMembership = { role: "admin", status: "suspended", save: jest.fn().mockResolvedValue() };
  OrganizationInvitation.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue(invitation) });
  Organization.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue({ _id: organizationId, name: "Team", slug: "team" }) });
  OrganizationMember.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue(suspendedMembership) });
  jest.spyOn(mongoose.connection, "transaction").mockImplementation((callback) => callback({ id: "session" }));
  const res = response();

  await acceptInvitation({ body: { token: "a".repeat(43) }, user: { _id: "new-user", email: "new.member@example.test", status: "active" } }, res, jest.fn());

  expect(suspendedMembership.status).toBe("active");
  expect(suspendedMembership.role).toBe("developer");
  expect(suspendedMembership.save).toHaveBeenCalledWith({ session: { id: "session" } });
  expect(invitation.status).toBe("accepted");
});

test("revocation invalidates a pending invitation", async () => {
  const invitation = { status: "pending", tokenHash: "hash", save: jest.fn().mockResolvedValue() };
  OrganizationInvitation.findOne.mockResolvedValue(invitation);
  const res = response();
  await revokeInvitation({ params: { organizationId, invitationId: "507f1f77bcf86cd799439012" } }, res, jest.fn());
  expect(invitation.status).toBe("revoked");
  expect(invitation.tokenHash).toBeUndefined();
  expect(invitation.revokedAt).toBeInstanceOf(Date);
  expect(invitation.save).toHaveBeenCalled();
});

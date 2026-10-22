jest.mock("../src/services/audit.service", () => ({ recordAuditEvent: jest.fn().mockResolvedValue(null) }));

const mongoose = require("mongoose");
const Organization = require("../src/models/Organization");
const OrganizationMember = require("../src/models/OrganizationMember");
const { recordAuditEvent } = require("../src/services/audit.service");
const { transferOwnership } = require("../src/controllers/member.controller");

const actorId = "000000000000000000000001";
const targetId = "000000000000000000000002";
const organizationId = "000000000000000000000003";

function response() {
  return { statusCode: 200, body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; } };
}

function setupOrganization() {
  jest.spyOn(Organization, "findOne").mockReturnValue({
    select: () => ({ lean: async () => ({ name: "Demo Team" }) }),
  });
}

beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.restoreAllMocks());

test("ownership transfer atomically demotes the current owner, promotes an active member, and records the handoff", async () => {
  setupOrganization();
  const transaction = jest.spyOn(mongoose.connection, "transaction").mockImplementation(callback => callback({ transaction: true }));
  const previousOwner = { user: actorId, role: "admin" };
  const newOwner = { user: targetId, role: "owner" };
  const update = jest.spyOn(OrganizationMember, "findOneAndUpdate")
    .mockResolvedValueOnce(previousOwner).mockResolvedValueOnce(newOwner);
  const req = { params: { organizationId }, body: { newOwnerId: targetId, confirmation: "Demo Team" },
    user: { _id: actorId }, organizationMembership: { _id: "owner-membership" } };
  const res = response();
  const next = jest.fn();

  await transferOwnership(req, res, next);

  expect(next).not.toHaveBeenCalled();
  expect(transaction).toHaveBeenCalledTimes(1);
  expect(update).toHaveBeenNthCalledWith(1, { _id: "owner-membership", user: actorId, organization: organizationId, status: "active", role: "owner" },
    { $set: { role: "admin" } }, expect.objectContaining({ session: { transaction: true }, runValidators: true }));
  expect(update).toHaveBeenNthCalledWith(2, { user: targetId, organization: organizationId, status: "active", role: { $in: ["admin", "developer"] } },
    { $set: { role: "owner" } }, expect.objectContaining({ session: { transaction: true }, runValidators: true }));
  expect(recordAuditEvent).toHaveBeenCalledWith(req, expect.objectContaining({
    action: "member.ownership_transferred", target: `member/${targetId}`,
    details: { previousOwnerId: actorId, newOwnerId: targetId },
  }));
  expect(res.body.data).toEqual({ newOwner: { userId: targetId, role: "owner" }, currentUserRole: "admin" });
});

test("ownership transfer rejects a wrong confirmation before opening a transaction", async () => {
  setupOrganization();
  const transaction = jest.spyOn(mongoose.connection, "transaction");
  const update = jest.spyOn(OrganizationMember, "findOneAndUpdate");
  const req = { params: { organizationId }, body: { newOwnerId: targetId, confirmation: "Other Team" },
    user: { _id: actorId }, organizationMembership: { _id: "owner-membership" } };
  const next = jest.fn();

  await transferOwnership(req, response(), next);

  expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  expect(transaction).not.toHaveBeenCalled();
  expect(update).not.toHaveBeenCalled();
});

test("ownership transfer rejects an inactive or ineligible target without writing an audit success", async () => {
  setupOrganization();
  jest.spyOn(mongoose.connection, "transaction").mockImplementation(callback => callback({ transaction: true }));
  const update = jest.spyOn(OrganizationMember, "findOneAndUpdate")
    .mockResolvedValueOnce({ user: actorId, role: "admin" }).mockResolvedValueOnce(null);
  const req = { params: { organizationId }, body: { newOwnerId: targetId, confirmation: "Demo Team" },
    user: { _id: actorId }, organizationMembership: { _id: "owner-membership" } };
  const next = jest.fn();

  await transferOwnership(req, response(), next);

  expect(update).toHaveBeenCalledTimes(2);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409, code: "NEW_OWNER_NOT_ELIGIBLE" }));
  expect(recordAuditEvent).not.toHaveBeenCalled();
});

test("ownership cannot be transferred to the current owner", async () => {
  const organizationLookup = jest.spyOn(Organization, "findOne");
  const transaction = jest.spyOn(mongoose.connection, "transaction");
  const req = { params: { organizationId }, body: { newOwnerId: actorId, confirmation: "Demo Team" },
    user: { _id: actorId }, organizationMembership: { _id: "owner-membership" } };
  const next = jest.fn();

  await transferOwnership(req, response(), next);

  expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  expect(organizationLookup).not.toHaveBeenCalled();
  expect(transaction).not.toHaveBeenCalled();
});

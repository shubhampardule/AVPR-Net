jest.mock("../src/services/account-lock.service", () => ({ lockActiveAccount: jest.fn().mockResolvedValue({ status: "active" }) }));
jest.mock("../src/services/audit.service", () => ({ recordAuditEvent: jest.fn().mockResolvedValue(null) }));

const mongoose = require("mongoose");
const Organization = require("../src/models/Organization");
const OrganizationMember = require("../src/models/OrganizationMember");
const { recordAuditEvent } = require("../src/services/audit.service");
const { createOrganization } = require("../src/controllers/organization.controller");

test("organization creation writes its first activity event after the member transaction", async () => {
  const organization = new Organization({ name: "AVPR-Net Team", slug: "securepatch-team" });
  jest.spyOn(Organization, "findOne").mockResolvedValue(null);
  jest.spyOn(Organization, "create").mockResolvedValue([organization]);
  jest.spyOn(OrganizationMember, "create").mockResolvedValue([]);
  jest.spyOn(mongoose.connection, "transaction").mockImplementation(callback => callback({ id: "session" }));
  const req = { body: { name: "AVPR-Net Team" }, user: { _id: new mongoose.Types.ObjectId() } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

  await createOrganization(req, res, jest.fn());

  expect(require("../src/services/account-lock.service").lockActiveAccount).toHaveBeenCalledWith(req.user._id, { id: "session" });
  expect(res.status).toHaveBeenCalledWith(201);
  expect(recordAuditEvent).toHaveBeenCalledWith(req, expect.objectContaining({
    organizationId: organization._id, action: "organization.created", target: `organization/${organization._id}`,
    details: { organizationName: "AVPR-Net Team", slug: "securepatch-team" },
  }));
});

test("organization creation refuses a deleted account before creating any membership", async () => {
  jest.clearAllMocks();
  const { lockActiveAccount } = require("../src/services/account-lock.service");
  lockActiveAccount.mockRejectedValueOnce(Object.assign(new Error("account changed"), { statusCode: 409 }));
  const next = jest.fn();
  await createOrganization({ body: { name: "Other Team" }, user: { _id: new mongoose.Types.ObjectId() } },
    { status: jest.fn().mockReturnThis(), json: jest.fn() }, next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 }));
  expect(Organization.create).not.toHaveBeenCalled();
  expect(OrganizationMember.create).not.toHaveBeenCalled();
});

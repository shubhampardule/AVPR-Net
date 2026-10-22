const mongoose = require("mongoose");
const Organization = require("../src/models/Organization");
const Member = require("../src/models/OrganizationMember");
const Invitation = require("../src/models/OrganizationInvitation");
const Automation = require("../src/models/RepositoryAutomation");
const Scan = require("../src/models/Scan");
const Audit = require("../src/models/AuditEvent");
const { requestOrganizationDeletion, purgeDueOrganizations, SETTLING_MS, BATCH_SIZE } = require("../src/services/organization-deletion.service");
const organizationId = new mongoose.Types.ObjectId();
const actorId = new mongoose.Types.ObjectId();
const now = new Date("2026-10-22T12:00:00Z");
const session = { transaction: true };
afterEach(() => jest.restoreAllMocks());
function setup() {
  jest.spyOn(mongoose.connection, "transaction").mockImplementation(callback => callback(session));
  jest.spyOn(Member, "findOneAndUpdate").mockResolvedValue({ role: "owner" });
  jest.spyOn(Organization, "findOneAndUpdate").mockResolvedValue({ _id: organizationId });
  for (const Model of [Member, Invitation, Automation, Scan]) jest.spyOn(Model, "updateMany").mockResolvedValue({});
  jest.spyOn(Audit, "create").mockResolvedValue([]);
}
test("deletion rechecks current ownership and exact name before disabling access, automation, and active scans", async () => {
  setup();
  const result = await requestOrganizationDeletion({ organizationId, actorId, confirmation: "Team", now });
  expect(result).toEqual({ status: "deleting", purgeAfter: new Date(now.getTime() + SETTLING_MS) });
  expect(Member.findOneAndUpdate).toHaveBeenCalledWith({ organization: organizationId, user: actorId, status: "active", role: "owner" }, expect.any(Object), { session, returnDocument: "after" });
  expect(Organization.findOneAndUpdate).toHaveBeenCalledWith({ _id: organizationId, status: "active", name: "Team" }, { $set: expect.objectContaining({ status: "deleting", githubInstallationId: null, hostedAiEnabled: false, purgeAfter: result.purgeAfter }) }, expect.objectContaining({ session }));
  expect(Automation.updateMany).toHaveBeenCalledWith({ organization: organizationId }, { $set: expect.objectContaining({ frequency: "off", push: false, pullRequest: false, pendingRefs: [] }) }, { session });
  expect(Scan.updateMany).toHaveBeenCalledWith({ organization: organizationId, status: { $in: ["queued", "running"] } }, { $set: expect.objectContaining({ status: "failed", cancelledAt: now, activeKey: null, leaseToken: null }) }, { session });
  expect(Audit.create).toHaveBeenCalledWith([expect.objectContaining({ organization: organizationId, action: "organization.deletion_requested" })], { session });
});
test("a stale or non-owner role cannot delete an organization", async () => {
  setup(); Member.findOneAndUpdate.mockResolvedValue(null);
  await expect(requestOrganizationDeletion({ organizationId, actorId, confirmation: "Team", now })).rejects.toMatchObject({ code: "OWNER_REQUIRED" });
  expect(Organization.findOneAndUpdate).not.toHaveBeenCalled();
});
test("a wrong name or inactive organization aborts the transaction", async () => {
  setup(); Organization.findOneAndUpdate.mockResolvedValue(null);
  await expect(requestOrganizationDeletion({ organizationId, actorId, confirmation: "wrong", now })).rejects.toMatchObject({ code: "ORGANIZATION_CHANGED" });
  expect(Scan.updateMany).not.toHaveBeenCalled(); expect(Audit.create).not.toHaveBeenCalled();
});
test("storage failure is propagated instead of falsely acknowledging deletion", async () => {
  setup(); Scan.updateMany.mockRejectedValue(new Error("write failed"));
  await expect(requestOrganizationDeletion({ organizationId, actorId, confirmation: "Team", now })).rejects.toThrow("write failed");
  expect(Audit.create).not.toHaveBeenCalled();
});

const modelNames = ["OrganizationInvitation", "RepositoryAutomation", "Notification", "AssistantCache", "Finding", "RemediationVerification", "Scan", "AuditEvent", "OrganizationMember"];
function purgeSetup({ remaining = false, fail = false } = {}) {
  const query = { select: jest.fn().mockReturnThis(), sort: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([{ _id: organizationId }]) };
  jest.spyOn(Organization, "find").mockReturnValue(query);
  jest.spyOn(Organization, "updateOne").mockResolvedValue({ modifiedCount: 1 });
  const collections = modelNames.map(name => {
    const collection = require(`../src/models/${name}`).collection;
    const ids = [{ _id: new mongoose.Types.ObjectId() }];
    jest.spyOn(collection, "find").mockReturnValue({ limit: jest.fn().mockReturnValue({ toArray: async () => ids }) });
    jest.spyOn(collection, "deleteMany").mockImplementation(async () => { if (fail) throw new Error("offline"); return { deletedCount: 1 }; });
    jest.spyOn(collection, "findOne").mockResolvedValue(remaining ? ids[0] : null);
    return { collection, ids };
  });
  return { query, collections };
}
test("purge selects only deletion requests whose settling time passed and scopes every bounded delete", async () => {
  const { collections, query } = purgeSetup();
  const result = await purgeDueOrganizations(now);
  expect(Organization.find).toHaveBeenCalledWith({ status: "deleting", purgeAfter: { $lte: now } });
  expect(query.limit).toHaveBeenCalledWith(3);
  for (const { collection, ids } of collections) {
    expect(collection.find).toHaveBeenCalledWith({ organization: organizationId }, { projection: { _id: 1 } });
    expect(collection.find.mock.results[0].value.limit).toHaveBeenCalledWith(BATCH_SIZE);
    expect(collection.deleteMany).toHaveBeenCalledWith({ organization: organizationId, _id: { $in: ids.map(item => item._id) } });
  }
  expect(Organization.updateOne).toHaveBeenLastCalledWith(expect.objectContaining({ status: "deleting", _id: organizationId }), { $set: expect.objectContaining({ status: "deleted", name: "Deleted organization", purgedAt: now }) });
  expect(result.completed).toBe(1);
});
test("large organizations remain pending until every scoped collection is empty", async () => {
  purgeSetup({ remaining: true });
  expect(await purgeDueOrganizations(now)).toMatchObject({ completed: 0 });
  expect(Organization.updateOne).toHaveBeenCalledTimes(1);
});
test("a failed purge remains retryable and does not mark data erased", async () => {
  purgeSetup({ fail: true });
  expect(await purgeDueOrganizations(now)).toMatchObject({ completed: 0, failed: 1 });
  expect(Organization.updateOne).toHaveBeenCalledTimes(1);
});

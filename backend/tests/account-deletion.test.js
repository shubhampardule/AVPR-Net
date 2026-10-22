jest.mock("../src/services/account-lock.service", () => ({ lockActiveAccount: jest.fn() }));
const mongoose = require("mongoose");
const User = require("../src/models/User");
const Member = require("../src/models/OrganizationMember");
const Invitation = require("../src/models/OrganizationInvitation");
const Notification = require("../src/models/Notification");
const Audit = require("../src/models/AuditEvent");
const { lockActiveAccount } = require("../src/services/account-lock.service");
const { deleteAccount } = require("../src/services/account-deletion.service");
const actor = "000000000000000000000001";
const org = "000000000000000000000002";
const session = { id: "transaction" };
let suspend, invitations, notifications, update, audit, sessions;
function memberships(items) { Member.find.mockReturnValue({ session: () => ({ lean: async () => items }) }); }
beforeEach(() => {
  jest.spyOn(mongoose.connection, "transaction").mockImplementation(callback => callback(session));
  lockActiveAccount.mockResolvedValue({ email: "person@example.com" });
  jest.spyOn(Member, "find"); memberships([]);
  suspend = jest.spyOn(Member, "updateMany").mockResolvedValue({ modifiedCount: 1 });
  invitations = jest.spyOn(Invitation, "deleteMany").mockResolvedValue({ deletedCount: 1 });
  notifications = jest.spyOn(Notification, "deleteMany").mockResolvedValue({ deletedCount: 1 });
  update = jest.spyOn(User, "updateOne").mockResolvedValue({ modifiedCount: 1 });
  audit = jest.spyOn(Audit, "create").mockResolvedValue([]);
  sessions = jest.fn().mockResolvedValue({ deletedCount: 2 });
  jest.spyOn(mongoose.connection, "collection").mockReturnValue({ deleteMany: sessions });
});
afterEach(() => { jest.restoreAllMocks(); jest.clearAllMocks(); });

test("deletes personal data and provider links atomically while preserving pseudonymous organization history", async () => {
  memberships([{ organization: org, role: "developer", status: "active" }]);
  await deleteAccount(actor, "person@example.com");
  expect(lockActiveAccount).toHaveBeenCalledWith(actor, session);
  expect(suspend).toHaveBeenCalledWith({ user: actor }, { $set: { status: "suspended", "notificationPreferences.scanResults": false } }, { session });
  expect(invitations).toHaveBeenCalledWith({ email: "person@example.com" }, { session });
  expect(notifications).toHaveBeenCalledWith({ recipient: actor }, { session });
  expect(sessions).toHaveBeenCalledWith(expect.objectContaining({ $or: expect.arrayContaining([{ "session.passport.user": actor }]) }), { session });
  expect(update).toHaveBeenCalledWith({ _id: actor, status: "active" }, expect.objectContaining({
    $set: expect.objectContaining({ status: "deleted", name: "Deleted account", email: `deleted-${actor}@account.invalid`, profileImage: null }),
    $unset: { googleId: "", githubId: "", githubUsername: "" },
  }), { session, runValidators: true });
  expect(audit).toHaveBeenCalledWith([expect.objectContaining({ organization: org, action: "member.account_deleted", actorLabel: "Deleted account", details: {} })], { session });
  expect(JSON.stringify(audit.mock.calls)).not.toContain("person@example.com");
});

test("refuses deletion for an active owner in any organization before removing data", async () => {
  memberships([{ organization: org, role: "owner", status: "active" }]);
  await expect(deleteAccount(actor, "person@example.com")).rejects.toMatchObject({ statusCode: 409, code: "OWNER_MUST_TRANSFER" });
  for (const operation of [suspend, invitations, notifications, update, audit, sessions]) expect(operation).not.toHaveBeenCalled();
});

test.each([undefined, "", {}, "another@example.com", "PERSON@example.com"])("refuses an incorrect email confirmation: %p", async confirmation => {
  await expect(deleteAccount(actor, confirmation)).rejects.toMatchObject({ statusCode: 400 });
  expect(update).not.toHaveBeenCalled();
});

test("a failed erasure aborts the transaction instead of reporting deletion", async () => {
  notifications.mockRejectedValue(new Error("storage unavailable"));
  await expect(deleteAccount(actor, "person@example.com")).rejects.toThrow("storage unavailable");
  expect(update).not.toHaveBeenCalled();
});

test("audit failure aborts rather than silently removing membership accountability", async () => {
  memberships([{ organization: org, role: "admin", status: "active" }]);
  audit.mockRejectedValue(new Error("audit unavailable"));
  await expect(deleteAccount(actor, "person@example.com")).rejects.toThrow("audit unavailable");
  expect(update).not.toHaveBeenCalled();
});

test("already deleted or suspended accounts cannot start another deletion", async () => {
  lockActiveAccount.mockRejectedValue(Object.assign(new Error("account changed"), { statusCode: 409 }));
  await expect(deleteAccount(actor, "person@example.com")).rejects.toMatchObject({ statusCode: 409 });
  expect(suspend).not.toHaveBeenCalled();
});

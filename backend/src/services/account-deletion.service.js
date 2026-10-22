const mongoose = require("mongoose");
const User = require("../models/User");
const OrganizationMember = require("../models/OrganizationMember");
const OrganizationInvitation = require("../models/OrganizationInvitation");
const Notification = require("../models/Notification");
const AuditEvent = require("../models/AuditEvent");
const { lockActiveAccount } = require("./account-lock.service");
const { bad } = require("../utils/input");

async function deleteAccount(userId, confirmation) {
  if (typeof confirmation !== "string" || !confirmation || confirmation.length > 320) {
    throw bad("Enter your account email exactly to confirm deletion");
  }
  await mongoose.connection.transaction(async session => {
    const account = await lockActiveAccount(userId, session);
    if (confirmation !== account.email) throw bad("Enter your account email exactly to confirm deletion");
    // Suspending all membership records also conflicts with concurrent transfers.
    // Roll back the entire transaction if any owner membership is encountered.
    const memberships = await OrganizationMember.find({ user: userId }).session(session).lean();
    if (memberships.some(member => member.status === "active" && member.role === "owner")) {
      throw bad("Transfer ownership of every organization before deleting your account", 409, "OWNER_MUST_TRANSFER");
    }
    await OrganizationMember.updateMany({ user: userId },
      { $set: { status: "suspended", "notificationPreferences.scanResults": false } }, { session });
    await OrganizationInvitation.deleteMany({ email: account.email }, { session });
    await Notification.deleteMany({ recipient: userId }, { session });
    await mongoose.connection.collection("sessions").deleteMany({ $or: [
      { "session.passport.user": String(userId) }, { "session.githubAccess.userId": String(userId) },
      { "session.githubOAuth.userId": String(userId) },
    ] }, { session });
    const activeMemberships = memberships.filter(member => member.status === "active");
    if (activeMemberships.length) await AuditEvent.create(activeMemberships.map(member => ({
      organization: member.organization, actor: userId, actorLabel: "Deleted account",
      action: "member.account_deleted", target: `member/${userId}`, details: {},
    })), { session });
    await User.updateOne({ _id: userId, status: "active" }, { $set: {
      status: "deleted", deletedAt: new Date(), name: "Deleted account",
      email: `deleted-${userId}@account.invalid`, profileImage: null,
    }, $unset: { googleId: "", githubId: "", githubUsername: "" } }, { session, runValidators: true });
  });
}
module.exports = { deleteAccount };

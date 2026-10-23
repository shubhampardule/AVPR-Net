const mongoose = require("mongoose");
const Organization = require("../models/Organization");
const Member = require("../models/OrganizationMember");
const Invitation = require("../models/OrganizationInvitation");
const Automation = require("../models/RepositoryAutomation");
const Scan = require("../models/Scan");
const Audit = require("../models/AuditEvent");
const { bad } = require("../utils/input");
const logger = require("../config/logger");
const SETTLING_MS = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 500;
// Native deletes intentionally implement the retention exception to the
// application models' append-only rules, scoped to one disabled organization.
const PURGE_MODELS = [
  "OrganizationInvitation", "RepositoryAutomation", "Notification", "AssistantCache", "Finding",
  "RemediationVerification", "Scan", "AuditEvent", "OrganizationMember",
];

async function requestOrganizationDeletion({ organizationId, actorId, confirmation, now = new Date() }) {
  if (typeof confirmation !== "string" || !confirmation || confirmation.length > 150) throw bad("Enter the organization name exactly to confirm deletion");
  const purgeAfter = new Date(now.getTime() + SETTLING_MS);
  await mongoose.connection.transaction(async session => {
    const owner = await Member.findOneAndUpdate({ organization: organizationId, user: actorId, status: "active", role: "owner" },
      { $set: { status: "suspended" } }, { session, returnDocument: "after" });
    if (!owner) throw bad("Only the current organization owner can delete this organization", 403, "OWNER_REQUIRED");
    const organization = await Organization.findOneAndUpdate({ _id: organizationId, status: "active", name: confirmation },
      { $set: { status: "deleting", deletionRequestedAt: now, purgeAfter, githubInstallationId: null, hostedAiEnabled: false } },
      { session, returnDocument: "after", runValidators: true });
    if (!organization) throw bad("The organization changed or its name does not match. Refresh and try again", 409, "ORGANIZATION_CHANGED");
    await Member.updateMany({ organization: organizationId }, { $set: { status: "suspended", "notificationPreferences.scanResults": false } }, { session });
    await Invitation.updateMany({ organization: organizationId, status: "pending" },
      { $set: { status: "revoked", revokedAt: now }, $unset: { tokenHash: "" } }, { session });
    await Automation.updateMany({ organization: organizationId },
      { $set: { frequency: "off", push: false, pullRequest: false, pendingRefs: [], nextRunAt: null, leaseUntil: null, leaseToken: null } }, { session });
    await Scan.updateMany({ organization: organizationId, status: { $in: ["queued", "running"] } },
      { $set: { status: "failed", cancelledAt: now, completedAt: now, activeKey: null, leaseUntil: null, leaseToken: null,
        errorMessage: "Organization deletion requested" } }, { session });
    await Audit.create([{ organization: organizationId, actor: actorId, actorLabel: `User ${String(actorId).slice(-8)}`,
      action: "organization.deletion_requested", target: `organization/${organizationId}`, details: { purgeAfter: purgeAfter.toISOString() } }], { session });
  });
  return { status: "deleting", purgeAfter };
}

async function purgeDueOrganizations(now = new Date()) {
  const due = await Organization.find({ status: "deleting", purgeAfter: { $lte: now } }).select("_id").sort({ purgeAttemptedAt: 1, purgeAfter: 1, _id: 1 }).limit(3).lean();
  const result = { processed: 0, completed: 0, failed: 0 };
  for (const organization of due) {
    result.processed++;
    try {
      await Organization.updateOne({ _id: organization._id, status: "deleting" }, { $set: { purgeAttemptedAt: now } });
      let remaining = false;
      for (const modelName of PURGE_MODELS) {
        const collection = require(`../models/${modelName}`).collection;
        const ids = await collection.find({ organization: organization._id }, { projection: { _id: 1 } }).limit(BATCH_SIZE).toArray();
        if (ids.length) await collection.deleteMany({ organization: organization._id, _id: { $in: ids.map(item => item._id) } });
        if (await collection.findOne({ organization: organization._id }, { projection: { _id: 1 } })) remaining = true;
      }
      // Legacy unscoped AI cache records expire after ten minutes, before eligibility.

      if (!remaining) {
        await Organization.updateOne({ _id: organization._id, status: "deleting", purgeAfter: { $lte: now } },
          { $set: { status: "deleted", purgedAt: now, name: "Deleted organization", slug: `deleted-${organization._id}`,
            githubInstallationId: null, hostedAiEnabled: false } });
        result.completed++;
      }
    } catch (error) {
      result.failed++;
      logger.error(`organization_purge_failed organization=${organization._id} error=${error.name || "Error"}`);
    }
  }
  return result;
}
module.exports = { requestOrganizationDeletion, purgeDueOrganizations, SETTLING_MS, BATCH_SIZE };

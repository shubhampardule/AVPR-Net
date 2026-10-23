// Explicit live integration test. All writes are confined to a fresh, disposable database.
require("dotenv").config({ quiet: true });
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const mongoose = require("mongoose");

function assertDisposableDatabase(databaseName, connection) {
  assert.match(databaseName, /^avpr_acceptance_[a-f0-9]{20}$/);
  assert.equal(connection.db.databaseName, databaseName);
}

async function main() {
  if (!process.argv.includes("--disposable") || !process.env.DATABASE_URL) {
    throw new Error("Run with --disposable and a configured DATABASE_URL");
  }
  // Stay below Atlas' 38-byte namespace limit with a fresh 20-character nonce.
  const databaseName = `avpr_acceptance_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
  const checks = [];
  let owned = false, cleanupComplete = false;
  let phase = "connect";
  const assertIsolated = () => assertDisposableDatabase(databaseName, mongoose.connection);
  try {
    const dnsServers = (process.env.MONGODB_DNS_SERVERS || "").split(",").map(value => value.trim()).filter(Boolean);
    if (dnsServers.length) require("node:dns").setServers(dnsServers);
    // Resolve SRV/TXT authentication defaults before overriding the data namespace.
    // The probe performs only a driver handshake, not application collection reads/writes.
    const probe = new mongoose.mongo.MongoClient(process.env.DATABASE_URL, { maxPoolSize: 1, serverSelectionTimeoutMS: 10000 });
    let authSource;
    try { await probe.connect(); authSource = probe.options.credentials?.source; }
    finally { await probe.close(); }
    phase = "disposable_connection";
    await mongoose.connect(process.env.DATABASE_URL, { dbName: databaseName, autoCreate: false, autoIndex: false,
      ...(authSource ? { authSource } : {}),
      maxPoolSize: 5, serverSelectionTimeoutMS: 10000, socketTimeoutMS: 15000 });
    assertIsolated();
    phase = "isolation_check";
    assert.equal((await mongoose.connection.db.listCollections({}, { nameOnly: true }).toArray()).length, 0);
    owned = true;
    console.log(JSON.stringify({ status: "started", database: databaseName }));
    phase = "schema_setup";
    const modelNames = ["User", "Organization", "OrganizationMember", "OrganizationInvitation", "RepositoryAutomation",
      "Notification", "AssistantCache", "Finding", "RemediationVerification", "Scan", "AuditEvent", "UsageBucket"];
    const models = Object.fromEntries(modelNames.map(name => [name, require(`../models/${name}`)]));
    for (const Model of Object.values(models)) { await Model.createCollection(); await Model.createIndexes(); }
    await mongoose.connection.db.createCollection("sessions");
    phase = "fixtures_and_checks";
    const { User, Organization, OrganizationMember: Member, OrganizationInvitation: Invitation,
      RepositoryAutomation: Automation, Scan, AuditEvent: Audit } = models;
    const { deleteAccount } = require("../services/account-deletion.service");
    const { lockActiveAccount } = require("../services/account-lock.service");
    const { requestOrganizationDeletion, purgeDueOrganizations, SETTLING_MS, BATCH_SIZE } = require("../services/organization-deletion.service");
    const [owner, developer, otherOwner, racer] = await User.create([
      { name: "Fixture owner", email: "owner@example.test", githubId: "fixture-owner" },
      { name: "Fixture developer", email: "developer@example.test", githubId: "fixture-developer" },
      { name: "Other fixture owner", email: "other@example.test" },
      { name: "Fixture race account", email: "race@example.test" },
    ]);
    const [target, other] = await Organization.create([{ name: "Fixture target", slug: "fixture-target", githubInstallationId: "fixture" },
      { name: "Fixture control", slug: "fixture-control" }]);
    await Member.create([{ user: owner._id, organization: target._id, role: "owner" },
      { user: developer._id, organization: target._id, role: "developer" },
      { user: otherOwner._id, organization: other._id, role: "owner" }]);

    await assert.rejects(deleteAccount(owner._id, owner.email), error => error.code === "OWNER_MUST_TRANSFER");
    assert.equal((await User.findById(owner._id)).accessRevision, 0);
    assert.equal((await Member.findOne({ user: owner._id, organization: target._id })).status, "active");
    checks.push("owner_deletion_rolls_back_account_lock_and_membership");

    const sessions = mongoose.connection.collection("sessions");
    await sessions.insertMany([{ _id: "fixture-dev-session", session: { passport: { user: String(developer._id) } } },
      { _id: "fixture-control-session", session: { passport: { user: String(otherOwner._id) } } }]);
    await deleteAccount(developer._id, developer.email);
    const deleted = await User.findById(developer._id);
    assert.equal(deleted.status, "deleted"); assert.equal(deleted.githubId, undefined);
    assert.equal(deleted.email, `deleted-${developer._id}@account.invalid`);
    assert.equal((await Member.findOne({ user: developer._id })).status, "suspended");
    assert.equal(await sessions.countDocuments({ _id: "fixture-dev-session" }), 0);
    assert.equal(await sessions.countDocuments({ _id: "fixture-control-session" }), 1);
    checks.push("personal_deletion_unlinks_identity_and_only_removes_own_sessions");

    const race = await Promise.allSettled([
      deleteAccount(racer._id, racer.email),
      mongoose.connection.transaction(async session => {
        await lockActiveAccount(racer._id, session);
        await Member.create([{ user: racer._id, organization: other._id, role: "developer" }], { session });
      }),
    ]);
    assert.equal(race[0].status, "fulfilled");
    assert.equal((await User.findById(racer._id)).status, "deleted");
    assert.equal(await Member.countDocuments({ user: racer._id, status: "active" }), 0);
    checks.push("concurrent_membership_grant_cannot_leave_deleted_account_active");

    phase = "automation_checks";
    checks.push(...await require("./automation-acceptance").runAutomationChecks(other._id));
    phase = "scan_completion_checks";
    checks.push(...await require("./scan-completion-acceptance").runScanCompletionChecks(other._id));
    phase = "scan_expiry_checks";
    checks.push(...await require("./scan-expiry-acceptance").runScanExpiryChecks(other._id));
    phase = "http_cancellation_checks";
    checks.push(...await require("./cancellation-acceptance").runCancellationChecks({ organization: other._id,
      actor: otherOwner, outsider: owner }));
    phase = "http_team_checks";
    checks.push(...await require("./team-acceptance").runTeamChecks());
    phase = "worker_process_checks";
    checks.push(...await require("./worker-process-acceptance").runWorkerProcessChecks({ organization: other._id, actor: otherOwner }));
    phase = "email_delivery_callback_checks";
    checks.push(...await require("./email-delivery-acceptance").runEmailDeliveryChecks({ organization: other._id, actor: otherOwner }));
    phase = "organization_deletion_checks";

    await Invitation.create({ organization: target._id, email: "pending@example.test", role: "developer", invitedBy: owner._id,
      tokenHash: "fixture-hash", expiresAt: new Date(Date.now() + 3600000) });
    await Automation.create({ organization: target._id, owner: "fixture", repo: "fixture", installationId: "fixture",
      frequency: "weekly", push: true, pendingRefs: ["a".repeat(40)], leaseToken: "old-claim", leaseUntil: new Date(Date.now() + 60000) });
    await Scan.create({ organization: target._id, installationId: "fixture", owner: "fixture", repo: "fixture",
      status: "running", activeKey: "fixture-active" });
    await assert.rejects(requestOrganizationDeletion({ organizationId: target._id, actorId: owner._id, confirmation: "wrong" }),
      error => error.code === "ORGANIZATION_CHANGED");
    assert.equal((await Member.findOne({ user: owner._id, organization: target._id })).status, "active");
    checks.push("organization_confirmation_failure_rolls_back_owner_suspension");

    const requestedAt = new Date();
    await requestOrganizationDeletion({ organizationId: target._id, actorId: owner._id, confirmation: target.name, now: requestedAt });
    assert.equal((await Organization.findById(target._id)).status, "deleting");
    assert.equal(await Member.countDocuments({ organization: target._id, status: "active" }), 0);
    assert.equal((await Invitation.findOne({ organization: target._id }).select("+tokenHash")).tokenHash, undefined);
    const automation = await Automation.findOne({ organization: target._id });
    assert.equal(automation.frequency, "off"); assert.equal(automation.leaseToken, null);
    assert.equal((await Scan.findOne({ organization: target._id })).status, "failed");
    assert.equal((await Organization.findById(other._id)).status, "active");
    checks.push("organization_deletion_disables_access_and_invalidates_automation_claims");

    // Native inserts create bounded synthetic audit metadata to test the purge batch boundary.
    await Audit.collection.insertMany(Array.from({ length: BATCH_SIZE + 1 }, (_, index) => ({ organization: target._id,
      actor: owner._id, actorLabel: "Fixture", action: "scan.started", target: `fixture/${index}`, createdAt: requestedAt })));
    assert.equal((await purgeDueOrganizations(requestedAt)).processed, 0);
    const eligibleAt = new Date(requestedAt.getTime() + SETTLING_MS + 1);
    assert.equal((await purgeDueOrganizations(eligibleAt)).completed, 0);
    assert.equal((await Organization.findById(target._id)).status, "deleting");
    assert.equal((await purgeDueOrganizations(eligibleAt)).completed, 1);
    assert.equal((await Organization.findById(target._id)).status, "deleted");
    assert.equal(await Audit.countDocuments({ organization: target._id }), 0);
    assert.equal(await Member.countDocuments({ organization: other._id, user: otherOwner._id, status: "active" }), 1);
    checks.push("settling_period_and_multiple_purge_passes_preserve_control_organization");
  } catch (error) {
    error.acceptancePhase = phase;
    error.acceptanceReason = /not authorized|not allowed|permission/i.test(String(error.message)) ? "ACCESS_DENIED"
      : /auth.*fail|authentication/i.test(String(error.message)) ? "AUTHENTICATION_FAILED" : "CHECK_FAILED";
    throw error;
  } finally {
    try {
      if (owned) { assertIsolated(); await mongoose.connection.db.dropDatabase(); cleanupComplete = true; }
    } finally {
      await mongoose.disconnect();
      console.log(JSON.stringify({ database: databaseName, checks, cleanupComplete, cleanup: owned ? (cleanupComplete ? "complete" : "failed") : "not_needed" }));
    }
  }
}
if (require.main === module) main().catch(error => {
  console.error(JSON.stringify({ status: "failed", phase: error.acceptancePhase || "configuration", reason: error.acceptanceReason || "CHECK_FAILED", errorType: error.name || "Error", code: error.code || null }));
  process.exitCode = 1;
});
module.exports = { main, assertDisposableDatabase };

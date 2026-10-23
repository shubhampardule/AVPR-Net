const assert = require("node:assert/strict");
const request = require("supertest");
const User = require("../models/User");
const Organization = require("../models/Organization");
const Member = require("../models/OrganizationMember");
const Invitation = require("../models/OrganizationInvitation");
const Audit = require("../models/AuditEvent");

async function runTeamChecks() {
  const checks = [];
  const [owner, newcomer, stranger, racer] = await User.create(["owner", "newcomer", "stranger", "racer"].map(name =>
    ({ name: `Team fixture ${name}`, email: `team-${name}@example.test` })));
  const team = await Organization.create({ name: "Fixture team acceptance", slug: "fixture-team-acceptance" });
  await Member.create({ user: owner._id, organization: team._id, role: "owner" });
  const app = require("./acceptance-http").createFixtureApp([owner, newcomer, stranger, racer], "/organizations", require("../routes/member.routes"));
  const root = `/organizations/${team._id}`;
  const as = (method, path, user) => request(app)[method](path).set("X-Fixture-Actor", String(user._id));
  const invite = async (actor, user) => {
    const result = await as("post", `${root}/invitations`, actor).send({ email: user.email, role: "developer", sendEmail: false });
    assert.equal(result.status, 201);
    assert.equal(result.body.data.invitation.emailDelivery.status, "manual");
    return { id: result.body.data.invitation.id, token: new URL(result.body.data.invitation.url).searchParams.get("token") };
  };
  const accept = (user, invitation) => as("post", "/organizations/invitations/accept", user).send({ token: invitation.token });
  const membership = user => Member.findOne({ organization: team._id, user: user._id });

  const first = await invite(owner, newcomer);
  assert.equal((await accept(stranger, first)).status, 403);
  assert.equal((await Invitation.findById(first.id)).status, "pending");
  assert.equal(await membership(stranger), null);
  checks.push("http_invitation_rejects_wrong_identity_without_consuming_link");

  assert.equal((await accept(newcomer, first)).status, 200);
  assert.equal((await membership(newcomer)).role, "developer");
  assert.equal((await accept(newcomer, first)).status, 410);
  assert.equal((await as("delete", `${root}/invitations/${first.id}`, owner)).status, 404);
  assert.equal((await Invitation.findById(first.id)).status, "accepted");
  assert.equal(await Audit.countDocuments({ organization: team._id, action: "invitation.accepted", target: `invitation/${first.id}` }), 1);
  checks.push("http_invitation_acceptance_is_single_use_and_cannot_be_revoked_afterward");

  assert.equal((await as("post", `${root}/invitations`, newcomer).send({ email: stranger.email, role: "developer", sendEmail: false })).status, 403);
  const revoked = await invite(owner, stranger);
  assert.equal((await as("delete", `${root}/invitations/${revoked.id}`, owner)).status, 200);
  assert.equal((await accept(stranger, revoked)).status, 410);
  const expired = await invite(owner, stranger);
  await Invitation.updateOne({ _id: expired.id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  assert.equal((await accept(stranger, expired)).status, 410);
  checks.push("http_team_permissions_and_revoked_expired_invitation_recovery_hold");

  assert.equal((await as("post", `${root}/ownership-transfer`, owner).send({ newOwnerId: String(newcomer._id), confirmation: "wrong" })).status, 400);
  assert.equal((await membership(owner)).role, "owner");
  assert.equal((await as("post", `${root}/ownership-transfer`, owner).send({ newOwnerId: String(newcomer._id), confirmation: team.name })).status, 200);
  assert.equal((await membership(newcomer)).role, "owner"); assert.equal((await membership(owner)).role, "admin");
  assert.equal((await as("post", `${root}/ownership-transfer`, owner).send({ newOwnerId: String(stranger._id), confirmation: team.name })).status, 403);
  assert.equal((await as("delete", `${root}/members/${newcomer._id}`, owner)).status, 403);
  assert.equal((await as("patch", `${root}/members/${newcomer._id}/role`, newcomer).send({ role: "admin" })).status, 403);
  checks.push("http_ownership_transfer_rechecks_roles_and_preserves_owner_protection");

  assert.equal((await as("delete", `${root}/members/me`, newcomer)).status, 409);
  assert.equal((await as("delete", `${root}/members/me`, owner)).status, 200);
  assert.equal((await membership(owner)).status, "suspended");
  assert.equal((await membership(newcomer)).role, "owner");
  assert.equal((await as("get", `${root}/members`, owner)).status, 403);
  checks.push("http_member_leave_revokes_access_without_removing_the_active_owner");

  const contested = await invite(newcomer, racer);
  const [acceptance, revocation] = await Promise.all([accept(racer, contested), as("delete", `${root}/invitations/${contested.id}`, newcomer)]);
  const final = await Invitation.findById(contested.id);
  if (final.status === "accepted") {
    assert.equal(acceptance.status, 200); assert.equal(revocation.status, 404);
    assert.equal((await membership(racer)).status, "active");
  } else {
    assert.equal(final.status, "revoked"); assert.equal(acceptance.status, 410); assert.equal(revocation.status, 200);
    assert.equal(await membership(racer), null);
  }
  assert.equal(await Audit.countDocuments({ organization: team._id, target: `invitation/${contested.id}`,
    action: { $in: ["invitation.accepted", "invitation.revoked"] } }), 1);
  checks.push("concurrent_http_acceptance_and_revocation_commit_one_consistent_outcome");
  return checks;
}

module.exports = { runTeamChecks };

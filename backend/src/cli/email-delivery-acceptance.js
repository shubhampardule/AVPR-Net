const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const express = require("express");
const request = require("supertest");
const { Webhook } = require("standardwebhooks");
const Invitation = require("../models/OrganizationInvitation");

async function runEmailDeliveryChecks({ organization, actor }) {
  const previous = process.env.RESEND_WEBHOOK_SECRET;
  const secret = `whsec_${crypto.randomBytes(32).toString("base64")}`;
  process.env.RESEND_WEBHOOK_SECRET = secret;
  const app = express();
  app.use(express.raw({ type: "application/json", limit: "128kb" }));
  app.use(require("../routes/invitation-email-webhook.routes"));
  app.use(require("../middleware/errorHandler"));
  const checks = [], first = "c".repeat(64), second = "d".repeat(64);
  try {
    const invitation = await Invitation.create({ organization, invitedBy: actor._id, email: "delivery-fixture@example.test",
      role: "developer", tokenHash: first, emailAttemptHash: first, emailStatus: "unknown", expiresAt: new Date(Date.now() + 3600000) });
    let sequence = 0;
    const post = (type, attempt = first, tamper = false) => {
      const text = JSON.stringify({ type, created_at: new Date().toISOString(), data: { tags: { invitation_attempt: attempt } } });
      const id = `msg_fixture_${++sequence}`, timestamp = new Date();
      return request(app).post("/webhooks/resend").set("Content-Type", "application/json")
        .set("svix-id", id).set("svix-timestamp", String(Math.floor(timestamp.getTime() / 1000)))
        .set("svix-signature", new Webhook(secret).sign(id, timestamp, text)).send(tamper ? `${text} ` : text);
    };
    const state = () => Invitation.findById(invitation._id);
    assert.equal((await post("email.delivered", first, true)).status, 401);
    assert.equal((await state()).emailStatus, "unknown");
    assert.equal((await post("email.delivered")).status, 202);
    assert.equal((await state()).emailStatus, "delivered");
    assert.equal((await post("email.delivered")).status, 202);
    assert.equal((await post("email.delivery_delayed")).status, 202);
    assert.equal((await state()).emailStatus, "delivered");
    assert.equal((await post("email.bounced")).status, 202);
    assert.equal((await post("email.delivered")).status, 202);
    assert.equal((await state()).emailStatus, "bounced");
    checks.push("signed_http_delivery_callbacks_are_idempotent_and_preserve_adverse_outcomes");

    await Invitation.updateOne({ _id: invitation._id }, { $set: { emailAttemptHash: second, tokenHash: second,
      emailStatus: "unknown", emailStatusAt: null } });
    assert.equal((await post("email.bounced", first)).status, 202);
    assert.equal((await state()).emailStatus, "unknown");
    assert.equal((await post("email.delivered", second)).status, 202);
    assert.equal((await state()).emailStatus, "delivered");
    checks.push("delivery_callbacks_from_replaced_invitation_attempts_are_ignored");

    await Invitation.updateOne({ _id: invitation._id }, { $set: { status: "accepted" }, $unset: { tokenHash: "" } });
    assert.equal((await post("email.complained", second)).status, 202);
    assert.equal((await state()).emailStatus, "delivered");
    checks.push("delivery_callbacks_cannot_rewrite_accepted_invitation_history");
  } finally {
    if (previous === undefined) delete process.env.RESEND_WEBHOOK_SECRET; else process.env.RESEND_WEBHOOK_SECRET = previous;
  }
  return checks;
}

module.exports = { runEmailDeliveryChecks };

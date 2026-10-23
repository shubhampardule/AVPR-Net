const { Webhook } = require("standardwebhooks");
const Invitation = require("../models/OrganizationInvitation");
const { bad } = require("../utils/input");
const RANK = { manual: 0, unknown: 0, accepted: 1, delayed: 2, delivered: 3, failed: 4, bounced: 5, complained: 6 };
const EVENTS = { "email.sent": "accepted", "email.delivery_delayed": "delayed", "email.delivered": "delivered",
  "email.failed": "failed", "email.bounced": "bounced", "email.complained": "complained", "email.suppressed": "failed" };

async function receive(body, headers) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) throw bad("Invitation delivery callbacks are not configured", 503, "EMAIL_WEBHOOK_UNAVAILABLE");
  let event;
  try {
    if (!Buffer.isBuffer(body) || body.length > 128 * 1024) throw new Error("Raw payload required");
    event = new Webhook(secret).verify(body, {
      "webhook-id": headers["svix-id"], "webhook-timestamp": headers["svix-timestamp"], "webhook-signature": headers["svix-signature"],
    });
  } catch { throw bad("Invalid delivery webhook signature", 401, "EMAIL_WEBHOOK_SIGNATURE"); }
  const status = Object.hasOwn(EVENTS, event?.type) ? EVENTS[event.type] : null;
  if (!status) return;
  const attempt = event.data?.tags?.invitation_attempt;
  const occurred = new Date(event.created_at);
  if (typeof attempt !== "string" || !/^[a-f0-9]{64}$/.test(attempt) || !Number.isFinite(occurred.getTime()) ||
    occurred.getTime() > Date.now() + 300000) return;
  // A refresh replaces the hash, invalidating old deliveries. Monotonic outcomes
  // make duplicate/out-of-order callbacks harmless and retain adverse outcomes.
  const lowerStates = Object.keys(RANK).filter(value => RANK[value] < RANK[status]);
  await Invitation.updateOne({ emailAttemptHash: attempt, status: "pending", emailStatus: { $in: lowerStates } },
    { $set: { emailStatus: status }, $max: { emailStatusAt: occurred } });
}

module.exports = { receive };

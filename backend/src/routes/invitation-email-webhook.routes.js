const router = require("express").Router();
const handler = require("../utils/asyncHandler");
router.post("/webhooks/resend", handler(async (req, res) => {
  try {
    await require("../services/invitation-email-webhook.service").receive(req.body, {
      "svix-id": req.get("svix-id"), "svix-timestamp": req.get("svix-timestamp"), "svix-signature": req.get("svix-signature"),
    });
  } catch (error) {
    if (error.code === "EMAIL_WEBHOOK_SIGNATURE") void require("../services/operations.service").recordSignal("webhook_reject");
    throw error;
  }
  // Same acknowledgement for old, duplicated and unrelated signed messages.
  res.status(202).json({ success: true });
}));
module.exports = router;

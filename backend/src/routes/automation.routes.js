const router = require("express").Router();
const { requireAuth } = require("../middleware/auth.middleware");
const { requireOrganizationMember } = require("../middleware/organization.middleware");
const { requireRole } = require("../middleware/rbac.middleware");
const handler = require("../utils/asyncHandler");
const service = require("../services/automation.service");
router.post("/webhooks/github", handler(async (req, res) => {
  if (!service.verifySignature(req.body, req.get("X-Hub-Signature-256"), process.env.GITHUB_WEBHOOK_SECRET)) {
    void require("../services/operations.service").recordSignal("webhook_reject");
    return res.status(401).json({ success: false, error: { code: "WEBHOOK_SIGNATURE", message: "Invalid webhook signature" } });
  }
  res.status(202).json({ success: true, data: await service.receive(req.body, req.get("X-GitHub-Event"), req.get("X-GitHub-Delivery")) });
}));
const route = "/organizations/:organizationId/repositories/:owner/:repo/automation";
async function automationData(settings) {
  const readiness = await require("../services/github-webhook-readiness.service").getWebhookReadiness();
  return { settings, webhookReady: readiness.push || readiness.pullRequest,
    eventReadiness: { push: readiness.push, pullRequest: readiness.pullRequest }, webhookIssue: readiness.issue };
}
router.get(route, requireAuth, requireOrganizationMember, handler(async (req, res) => {
  res.json({ success: true, data: await automationData(await service.settings(req.params.organizationId, req.params.owner, req.params.repo)) });
}));
router.put(route, requireAuth, requireOrganizationMember, requireRole("owner", "admin"), handler(async (req, res) => {
  res.json({ success: true, data: await automationData(await service.settings(req.params.organizationId, req.params.owner, req.params.repo, req.body)) });
}));
module.exports = router;

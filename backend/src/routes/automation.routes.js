const router = require("express").Router();
const { requireAuth } = require("../middleware/auth.middleware");
const { requireOrganizationMember } = require("../middleware/organization.middleware");
const { requireRole } = require("../middleware/rbac.middleware");
const handler = require("../utils/asyncHandler");
const service = require("../services/automation.service");
router.post("/webhooks/github", handler(async (req, res) => {
  if (!service.verifySignature(req.body, req.get("X-Hub-Signature-256"), process.env.GITHUB_WEBHOOK_SECRET)) return res.status(401).json({ success: false, error: { code: "WEBHOOK_SIGNATURE", message: "Invalid webhook signature" } });
  res.status(202).json({ success: true, data: await service.receive(req.body, req.get("X-GitHub-Event"), req.get("X-GitHub-Delivery")) });
}));
const route = "/organizations/:organizationId/repositories/:owner/:repo/automation";
router.get(route, requireAuth, requireOrganizationMember, handler(async (req, res) => {
  res.json({ success: true, data: { settings: await service.settings(req.params.organizationId, req.params.owner, req.params.repo), webhookReady: Boolean(process.env.GITHUB_WEBHOOK_SECRET) } });
}));
router.put(route, requireAuth, requireOrganizationMember, requireRole("owner", "admin"), handler(async (req, res) => {
  res.json({ success: true, data: { settings: await service.settings(req.params.organizationId, req.params.owner, req.params.repo, req.body), webhookReady: Boolean(process.env.GITHUB_WEBHOOK_SECRET) } });
}));
module.exports = router;

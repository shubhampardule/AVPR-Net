const express = require("express");
const {
  createOrganization,
  getMyOrganizations,
  getOrganization,
  getAiSettings,
  updateAiSettings,
  exportOrganization,
} = require("../controllers/organization.controller");
const {
  requireOrganizationMember,
} = require("../middleware/organization.middleware");

const { requireAuth } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/rbac.middleware");

const router = express.Router();

router.post("/", requireAuth, createOrganization);
router.get("/", requireAuth, getMyOrganizations);
router.get("/:organizationId", requireAuth, requireOrganizationMember, getOrganization);
router.get("/:organizationId/ai-settings", requireAuth, requireOrganizationMember, getAiSettings);
router.patch("/:organizationId/ai-settings", requireAuth, requireOrganizationMember, requireRole("owner", "admin"), updateAiSettings);
router.get("/:organizationId/export", requireAuth, requireOrganizationMember, requireRole("owner", "admin"), exportOrganization);


router.delete("/:organizationId", requireAuth, requireOrganizationMember, requireRole("owner"), require("../controllers/organization-deletion.controller").deleteOrganization);

module.exports = router;

const express = require("express");
const { requireAuth, } = require("../middleware/auth.middleware");
const { requireOrganizationMember, } = require("../middleware/organization.middleware");
const { requireRole, } = require("../middleware/rbac.middleware");
const { getMembers, addMember, updateMemberRole, removeMember,} = require("../controllers/member.controller");

const router = express.Router();

router.get(
    "/:organizationId/members",
    requireAuth,
    requireOrganizationMember,
    getMembers
);

router.post(
    "/:organizationId/members",
    requireAuth,
    requireOrganizationMember,
    requireRole("owner", "admin"),
    addMember
);

router.patch(
    "/:organizationId/members/:userId/role",
    requireAuth,
    requireOrganizationMember,
    requireRole("owner"),
    updateMemberRole
);

router.delete(
  "/:organizationId/members/:userId",
  requireAuth,
  requireOrganizationMember,
  requireRole("owner", "admin"),
  removeMember
);

module.exports = router;
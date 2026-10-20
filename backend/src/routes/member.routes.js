const express = require("express");
const { requireAuth, } = require("../middleware/auth.middleware");
const { requireOrganizationMember, } = require("../middleware/organization.middleware");
const { requireRole, } = require("../middleware/rbac.middleware");
const { getMembers, updateMemberRole, removeMember,} = require("../controllers/member.controller");
const { createInvitation, listInvitations, revokeInvitation, acceptInvitation } = require("../controllers/invitation.controller");

const router = express.Router();

router.get(
    "/:organizationId/members",
    requireAuth,
    requireOrganizationMember,
    getMembers
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

router.get(
  "/:organizationId/invitations",
  requireAuth,
  requireOrganizationMember,
  requireRole("owner", "admin"),
  listInvitations
);

router.post(
  "/:organizationId/invitations",
  requireAuth,
  requireOrganizationMember,
  requireRole("owner", "admin"),
  createInvitation
);

router.delete(
  "/:organizationId/invitations/:invitationId",
  requireAuth,
  requireOrganizationMember,
  requireRole("owner", "admin"),
  revokeInvitation
);

router.post("/invitations/accept", requireAuth, acceptInvitation);

module.exports = router;

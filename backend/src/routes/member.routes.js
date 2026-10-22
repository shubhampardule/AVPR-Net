const express = require("express");
const { requireAuth, } = require("../middleware/auth.middleware");
const { requireOrganizationMember, } = require("../middleware/organization.middleware");
const { requireRole, } = require("../middleware/rbac.middleware");
const { getMembers, updateMemberRole, removeMember, transferOwnership, leaveOrganization,} = require("../controllers/member.controller");
const { createInvitation, listInvitations, revokeInvitation, acceptInvitation } = require("../controllers/invitation.controller");
const AuditEvent = require("../models/AuditEvent");
const handler = require("../utils/asyncHandler");
const { integer } = require("../utils/input");

const router = express.Router();

router.post(
  "/:organizationId/ownership-transfer",
  requireAuth,
  requireOrganizationMember,
  requireRole("owner"),
  transferOwnership
);

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
  "/:organizationId/members/me",
  requireAuth,
  requireOrganizationMember,
  leaveOrganization
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

router.get(
  "/:organizationId/audit-events",
  requireAuth,
  requireOrganizationMember,
  requireRole("owner", "admin"),
  handler(async (req, res) => {
    const page = integer(req.query.page, 1, 100000);
    const limit = integer(req.query.limit, 20, 100);
    const filter = { organization: req.params.organizationId };
    const [events, total] = await Promise.all([
      AuditEvent.find(filter).select("actor actorLabel action target details requestId createdAt")
        .populate("actor", "name githubUsername").sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit).limit(limit).lean(),
      AuditEvent.countDocuments(filter),
    ]);
    return res.json({ success: true, data: {
      events: events.map(event => ({ ...event, actorLabel: event.actor?.name || event.actor?.githubUsername || event.actorLabel })),
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    } });
  })
);

module.exports = router;

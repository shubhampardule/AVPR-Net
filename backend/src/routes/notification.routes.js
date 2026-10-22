const express = require("express");
const Notification = require("../models/Notification");
const OrganizationMember = require("../models/OrganizationMember");
const { requireAuth } = require("../middleware/auth.middleware");
const { requireOrganizationMember } = require("../middleware/organization.middleware");
const handler = require("../utils/asyncHandler");
const { bad, integer, objectId } = require("../utils/input");

const router = express.Router();

router.get("/:organizationId/notifications", requireAuth, requireOrganizationMember, handler(async (req, res) => {
  const page = integer(req.query.page, 1, 100000);
  const limit = integer(req.query.limit, 20, 100);
  if (req.query.unreadOnly !== undefined && !["true", "false"].includes(req.query.unreadOnly)) throw bad("unreadOnly must be true or false");
  const filter = { organization: req.params.organizationId, recipient: req.user._id,
    ...(req.query.unreadOnly === "true" ? { readAt: null } : {}) };
  const unreadFilter = { organization: req.params.organizationId, recipient: req.user._id, readAt: null };
  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter).select("type title body href scan repository createdAt readAt")
      .sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments(unreadFilter),
  ]);
  res.json({ success: true, data: { notifications, unreadCount,
    preferences: { scanResults: req.organizationMembership.notificationPreferences?.scanResults !== false },
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } } });
}));

router.patch("/:organizationId/notifications/read-all", requireAuth, requireOrganizationMember, handler(async (req, res) => {
  const result = await Notification.updateMany({ organization: req.params.organizationId, recipient: req.user._id, readAt: null },
    { $set: { readAt: new Date() } });
  res.json({ success: true, data: { markedRead: result.modifiedCount || 0 } });
}));

router.patch("/:organizationId/notifications/:notificationId/read", requireAuth, requireOrganizationMember, handler(async (req, res) => {
  objectId(req.params.notificationId);
  const notification = await Notification.findOneAndUpdate({ _id: req.params.notificationId,
    organization: req.params.organizationId, recipient: req.user._id }, { $set: { readAt: new Date() } },
  { returnDocument: "after" }).select("_id readAt").lean();
  if (!notification) throw bad("Notification not found", 404);
  res.json({ success: true, data: { notification } });
}));

router.patch("/:organizationId/notification-preferences", requireAuth, requireOrganizationMember, handler(async (req, res) => {
  const body = req.body || {};
  if (Object.keys(body).length !== 1 || typeof body.scanResults !== "boolean") throw bad("Set only the scanResults preference to true or false");
  const membership = await OrganizationMember.findOneAndUpdate({ _id: req.organizationMembership._id,
    user: req.user._id, organization: req.params.organizationId, status: "active" },
  { $set: { "notificationPreferences.scanResults": body.scanResults } }, { returnDocument: "after", runValidators: true });
  if (!membership) throw bad("Active organization membership not found", 404);
  res.json({ success: true, data: { preferences: { scanResults: membership.notificationPreferences?.scanResults !== false } } });
}));

router.get("/:organizationId/notification-preferences", requireAuth, requireOrganizationMember, handler(async (req, res) => {
  res.json({ success: true, data: { preferences: {
    scanResults: req.organizationMembership.notificationPreferences?.scanResults !== false,
  } } });
}));

module.exports = router;

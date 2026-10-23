const crypto = require("node:crypto");
const mongoose = require("mongoose");
const Organization = require("../models/Organization");
const OrganizationInvitation = require("../models/OrganizationInvitation");
const OrganizationMember = require("../models/OrganizationMember");
const User = require("../models/User");
const ApiResponse = require("../utils/ApiResponse");
const { recordAuditEvent } = require("../services/audit.service");
const invitationEmail = require("../services/invitation-email.service");

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_PENDING_INVITATIONS = 100;

function fail(res, status, code, message) {
  return res.status(status).json({ success: false, error: { code, message } });
}

function invitationError(status, code, message) {
  const error = new Error(message);
  error.statusCode = status;
  error.code = code;
  return error;
}

function invitationUrl(token) {
  const frontend = (process.env.FRONTEND_URL || "http://localhost:5174").replace(/\/+$/, "");
  return `${frontend}/invite/accept?token=${encodeURIComponent(token)}`;
}

async function createInvitation(req, res, next) {
  try {
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const role = req.body.role;
    if (req.body.sendEmail !== undefined && typeof req.body.sendEmail !== "boolean") {
      return fail(res, 400, "INVALID_EMAIL_OPTION", "Email delivery must be true or false");
    }
    const sendEmail = req.body.sendEmail === true;
    if (sendEmail && !invitationEmail.available()) {
      return fail(res, 503, "INVITATION_EMAIL_UNAVAILABLE", "Email delivery is unavailable. Create and share an invitation link instead.");
    }
    if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return fail(res, 400, "INVALID_EMAIL", "Enter a valid email address for the invite");
    }
    if (!["admin", "developer"].includes(role)) {
      return fail(res, 400, "INVALID_ROLE", "Invite role must be admin or developer");
    }
    if (role === "admin" && req.organizationMembership?.role !== "owner") {
      return fail(res, 403, "OWNER_REQUIRED", "Only an organization owner can invite an admin");
    }

    const account = await User.findOne({ email });
    if (account?.status && account.status !== "active") {
      return fail(res, 409, "USER_INACTIVE", "This account cannot accept an organization invitation");
    }
    if (account) {
      const membership = await OrganizationMember.findOne({
        user: account._id,
        organization: req.params.organizationId,
        status: "active",
      });
      if (membership) return fail(res, 409, "MEMBERSHIP_EXISTS", "This person is already a member of the organization");
    }

    const pendingCount = await OrganizationInvitation.countDocuments({
      organization: req.params.organizationId,
      status: "pending",
      expiresAt: { $gt: new Date() },
    });
    const existing = await OrganizationInvitation.findOne({
      organization: req.params.organizationId,
      email,
      status: "pending",
    });
    if (sendEmail && existing?.emailAttemptedAt && Date.now() - new Date(existing.emailAttemptedAt).getTime() < 60000) {
      return fail(res, 429, "INVITATION_EMAIL_COOLDOWN", "Wait one minute before emailing this invitation again.");
    }
    if (!existing && pendingCount >= MAX_PENDING_INVITATIONS) {
      return fail(res, 429, "INVITATION_LIMIT", "This organization has reached its pending invitation limit");
    }

    const token = crypto.randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
    const fields = {
      email,
      role,
      invitedBy: req.user._id,
      tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
      expiresAt,
      acceptedAt: null,
      revokedAt: null,
      status: "pending",
      emailStatus: sendEmail ? "unknown" : "manual",
      emailAttemptHash: sendEmail ? crypto.createHash("sha256").update(token).digest("hex") : null,
      emailStatusAt: null,
      ...(sendEmail ? { emailAttemptedAt: new Date() } : {}),
    };
    let invitation;
    if (existing) {
      invitation = await OrganizationInvitation.findOneAndUpdate({ _id: existing._id, status: "pending",
        ...(sendEmail ? { $or: [{ emailAttemptedAt: null }, { emailAttemptedAt: { $lte: new Date(Date.now() - 60000) } }] } : {}),
      }, { $set: fields }, { returnDocument: "after", runValidators: true });
      if (!invitation) return fail(res, 409, "INVITATION_CHANGED", "This invitation changed or was just emailed. Refresh the list and wait one minute before emailing again.");
    } else {
      invitation = await OrganizationInvitation.create({
        ...fields,
        organization: req.params.organizationId,
      });
    }
    await recordAuditEvent(req, {
      action: "invitation.created",
      target: `invitation/${invitation._id}`,
      details: { invitationId: String(invitation._id), role, refreshed: Boolean(existing) },
    });

    const url = invitationUrl(token);
    let emailDelivery = { status: "manual" };
    if (sendEmail) {
      emailDelivery = await invitationEmail.send({ email, url, role, expiresAt, tokenHash: fields.tokenHash });
      // A newer invitation may already have replaced this token. Never overwrite its status.
      try {
        await OrganizationInvitation.updateOne({ _id: invitation._id, tokenHash: fields.tokenHash, status: "pending", emailStatus: "unknown" },
          { $set: { emailStatus: emailDelivery.status === "not_configured" ? "failed" : emailDelivery.status } });
      } catch {
        emailDelivery = { ...emailDelivery, statusRecorded: false };
      }
      // Provider IDs are not needed by clients or stored invitation records.
      delete emailDelivery.providerId;
    }

    return ApiResponse.success(res, {
      invitation: {
        id: invitation._id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        url,
        emailDelivery,
      },
    }, existing ? "Invitation link refreshed" : "Invitation created", existing ? 200 : 201);
  } catch (error) {
    if (error?.code === 11000) {
      return fail(res, 409, "INVITATION_EXISTS", "An invitation for this email was created at the same time; refresh the invitation list");
    }
    next(error);
  }
}

async function listInvitations(req, res, next) {
  try {
    const invitations = await OrganizationInvitation.find({
      organization: req.params.organizationId,
      status: "pending",
    }).select("email role invitedBy expiresAt createdAt emailStatus emailAttemptedAt").populate("invitedBy", "name email").sort({ createdAt: -1 }).limit(MAX_PENDING_INVITATIONS);

    const now = Date.now();
    return ApiResponse.success(res, {
      emailDeliveryAvailable: invitationEmail.available(),
      invitations: invitations.map((invitation) => ({
        id: invitation._id,
        email: invitation.email,
        role: invitation.role,
        invitedBy: invitation.invitedBy ? { name: invitation.invitedBy.name, email: invitation.invitedBy.email } : null,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
        status: invitation.expiresAt.getTime() > now ? "pending" : "expired",
        emailStatus: invitation.emailStatus || "manual",
      })),
    }, "Organization invitations retrieved successfully");
  } catch (error) {
    next(error);
  }
}

async function revokeInvitation(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.invitationId)) {
      return fail(res, 404, "INVITATION_NOT_FOUND", "Pending invitation not found");
    }
    const invitation = await OrganizationInvitation.findOneAndUpdate({
      _id: req.params.invitationId,
      organization: req.params.organizationId,
      status: "pending",
    }, { $set: { status: "revoked", revokedAt: new Date() }, $unset: { tokenHash: "" } },
    { returnDocument: "after" });
    if (!invitation) return fail(res, 404, "INVITATION_NOT_FOUND", "Pending invitation not found");
    await recordAuditEvent(req, {
      action: "invitation.revoked",
      target: `invitation/${invitation._id}`,
      details: { invitationId: String(invitation._id) },
    });
    return ApiResponse.success(res, null, "Invitation revoked");
  } catch (error) {
    next(error);
  }
}

async function acceptInvitation(req, res, next) {
  try {
    const token = typeof req.body.token === "string" ? req.body.token : "";
    if (token.length < 32 || token.length > 256) {
      return fail(res, 410, "INVITATION_INVALID", "This invitation link is invalid, expired, or already used");
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    let result, acceptedInvitationId;
    try {
      await mongoose.connection.transaction(async (session) => {
        await require("../services/account-lock.service").lockActiveAccount(req.user._id, session);
        const invitation = await OrganizationInvitation.findOne({
          tokenHash,
          status: "pending",
          expiresAt: { $gt: new Date() },
        }).session(session);
        if (!invitation) throw invitationError(410, "INVITATION_INVALID", "This invitation link is invalid, expired, or already used");
        if (invitation.email !== String(req.user.email || "").trim().toLowerCase()) {
          throw invitationError(403, "INVITATION_EMAIL_MISMATCH", "Sign in with the exact verified email address this invitation was sent to");
        }
        if (req.user.status !== "active") {
          throw invitationError(403, "USER_INACTIVE", "This account cannot accept organization invitations");
        }

        const organization = await Organization.findOne({ _id: invitation.organization, status: "active" }).session(session);
        if (!organization) throw invitationError(410, "ORGANIZATION_UNAVAILABLE", "The organization is no longer available");

        let membership = await OrganizationMember.findOne({
          user: req.user._id,
          organization: invitation.organization,
        }).session(session);
        if (membership?.status === "active") {
          throw invitationError(409, "MEMBERSHIP_EXISTS", "You are already a member of this organization");
        }
        if (!membership) {
          membership = new OrganizationMember({
            user: req.user._id,
            organization: invitation.organization,
            role: invitation.role,
            status: "active",
          });
        } else {
          membership.role = invitation.role;
          membership.status = "active";
        }
        await membership.save({ session });
        invitation.status = "accepted";
        invitation.tokenHash = undefined;
        invitation.acceptedAt = new Date();
        await invitation.save({ session });
        acceptedInvitationId = invitation._id;
        result = {
          organization: { id: organization._id, name: organization.name, slug: organization.slug },
          role: membership.role,
        };
      });
    } catch (error) {
      if (error.statusCode) return fail(res, error.statusCode, error.code, error.message);
      throw error;
    }

    await recordAuditEvent(req, {
      organizationId: result.organization.id,
      action: "invitation.accepted",
      target: `invitation/${acceptedInvitationId}`,
      details: { role: result.role },
    });

    return ApiResponse.success(res, result, "Organization invitation accepted");
  } catch (error) {
    next(error);
  }
}

module.exports = { createInvitation, listInvitations, revokeInvitation, acceptInvitation };

const mongoose = require("mongoose");

const organizationInvitationSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    required: true,
  },
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 320 },
  role: { type: String, enum: ["admin", "developer"], required: true },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  tokenHash: { type: String, select: false },
  status: { type: String, enum: ["pending", "accepted", "revoked"], default: "pending", required: true },
  expiresAt: { type: Date, required: true },
  acceptedAt: { type: Date, default: null },
  revokedAt: { type: Date, default: null },
}, { timestamps: true });

organizationInvitationSchema.index(
  { organization: 1, email: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } }
);
organizationInvitationSchema.index({ tokenHash: 1 }, { unique: true, sparse: true });
organizationInvitationSchema.index({ organization: 1, status: 1, expiresAt: 1 });

module.exports = mongoose.models.OrganizationInvitation ||
  mongoose.model("OrganizationInvitation", organizationInvitationSchema);

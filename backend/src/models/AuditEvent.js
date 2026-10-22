const mongoose = require("mongoose");

const AUDIT_ACTIONS = [
  "organization.created",
  "organization.exported",
  "organization.deletion_requested",
  "scan.started",
  "scan.cancelled",
  "finding.reviewed",
  "github.installation_connected",
  "github.installation_disconnected",
  "member.role_changed",
  "member.removed",
  "member.left",
  "member.account_deleted",
  "member.ownership_transferred",
  "invitation.created",
  "invitation.revoked",
  "invitation.accepted",
  "ai.settings_changed",
  "ai.request_consented",
  "pull_request.draft_created",
];

const auditEventSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, immutable: true, index: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
  actorLabel: { type: String, required: true, maxlength: 120, immutable: true },
  action: { type: String, enum: AUDIT_ACTIONS, required: true, immutable: true, index: true },
  target: { type: String, required: true, maxlength: 300, immutable: true },
  details: { type: mongoose.Schema.Types.Mixed, default: {}, immutable: true },
  requestId: { type: String, default: null, maxlength: 100, immutable: true },
}, {
  timestamps: { createdAt: true, updatedAt: false },
  versionKey: false,
  strict: "throw",
});

auditEventSchema.index({ organization: 1, createdAt: -1, _id: -1 });

auditEventSchema.pre("save", function rejectAuditMutation() {
  if (!this.isNew) throw new Error("Audit events are append-only");
});

for (const operation of ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "deleteOne", "deleteMany", "findOneAndDelete"]) {
  auditEventSchema.pre(operation, function rejectAuditQueryMutation() {
    throw new Error("Audit events are append-only");
  });
}

module.exports = mongoose.models.AuditEvent || mongoose.model("AuditEvent", auditEventSchema);
module.exports.AUDIT_ACTIONS = AUDIT_ACTIONS;

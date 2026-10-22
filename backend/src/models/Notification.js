const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, immutable: true, index: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true, index: true },
  type: { type: String, enum: ["scan.completed", "scan.partial", "scan.failed"], required: true, immutable: true },
  dedupeKey: { type: String, required: true, maxlength: 180, immutable: true },
  title: { type: String, required: true, maxlength: 120, immutable: true },
  body: { type: String, required: true, maxlength: 300, immutable: true },
  href: { type: String, required: true, maxlength: 500, immutable: true },
  scan: { type: mongoose.Schema.Types.ObjectId, ref: "Scan", required: true, immutable: true },
  repository: { type: String, required: true, maxlength: 140, immutable: true },
  createdAt: { type: Date, default: Date.now, immutable: true },
  readAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true, immutable: true },
}, { versionKey: false, strict: "throw" });

notificationSchema.index({ recipient: 1, dedupeKey: 1 }, { unique: true, name: "notification_recipient_dedupe" });
notificationSchema.index({ organization: 1, recipient: 1, createdAt: -1, _id: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "notification_ttl" });

module.exports = mongoose.models.Notification || mongoose.model("Notification", notificationSchema);

const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
  owner: { type: String, required: true }, repo: { type: String, required: true },
  installationId: { type: String, required: true },
  push: { type: Boolean, default: false }, pullRequest: { type: Boolean, default: false },
  frequency: { type: String, enum: ["off", "weekly", "monthly"], default: "off" },
  nextRunAt: { type: Date, default: null }, leaseUntil: { type: Date, default: null },
  leaseToken: { type: String, default: null },
  lastError: { type: String, default: null }, lastScanId: { type: String, default: null },
  pendingRefs: { type: [String], default: [] },
}, { timestamps: true });
schema.index({ organization: 1, owner: 1, repo: 1 }, { unique: true });
schema.index({ nextRunAt: 1 });
module.exports = mongoose.models.RepositoryAutomation || mongoose.model("RepositoryAutomation", schema);

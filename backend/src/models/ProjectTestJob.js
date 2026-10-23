const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  scan: { type: mongoose.Schema.Types.ObjectId, required: true },
  finding: { type: mongoose.Schema.Types.ObjectId, required: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, required: true },
  rescan: { type: mongoose.Schema.Types.ObjectId, required: true },
  key: { type: String, required: true, unique: true },
  patch: { type: String, maxlength: 18000, select: false },
  patchHash: String, sourceHash: String, proposedHash: String, policyHash: String,
  commitSha: String, targetPath: String, runnerRevision: String,
  status: { type: String, enum: ["queued", "running", "completed", "failed", "cancelled"], required: true },
  runId: String, lease: { type: String, select: false }, leaseUntil: Date,
  result: { type: mongoose.Schema.Types.Mixed, default: null }, errorCode: String,
  deadlineAt: Date, completedAt: Date, expiresAt: { type: Date, expires: 0 },
}, { timestamps: true, strict: "throw" });
schema.index({ status: 1, deadlineAt: 1 });
schema.index({ runId: 1 }, { unique: true, partialFilterExpression: { runId: { $type: "string" } } });
module.exports = mongoose.models.ProjectTestJob || mongoose.model("ProjectTestJob", schema);

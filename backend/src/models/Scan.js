const mongoose = require("mongoose");

const scanSchema = new mongoose.Schema(
  {
    commitSha: { type: String, default: null },
    includeDependencies: { type: Boolean, default: false },
    branch: { type: String, default: null },
    activeKey: { type: String, default: null },
    deadlineAt: { type: Date, default: null },
    leaseUntil: { type: Date, default: null },
    leaseToken: { type: String, default: null },
    cancelledAt: { type: Date, default: null },
    coverage: { type: [mongoose.Schema.Types.Mixed], default: [] },
    rulesHash: { type: String, default: null },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    installationId: {
      type: String,
      required: true,
    },
    owner: {
      type: String,
      required: true,
      trim: true,
    },
    repo: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["queued", "running", "completed", "failed"],
      default: "queued",
      index: true,
    },
    jobId: {
      type: String,
      default: null,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    scannersUsed: [
      {
        type: String,
      },
    ],
    scannerErrors: [
      {
        scanner: { type: String, required: true },
        message: { type: String, required: true },
        exitCode: { type: Number, default: null },
        stderr: { type: String, default: "" },
      },
    ],
    summary: {
      total: { type: Number, default: 0 },
      critical: { type: Number, default: 0 },
      high: { type: Number, default: 0 },
      medium: { type: Number, default: 0 },
      low: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  }
);

scanSchema.index({ organization: 1, owner: 1, repo: 1, createdAt: -1 });
scanSchema.index({ activeKey: 1 }, { unique: true, partialFilterExpression: { activeKey: { $type: "string" } } });

module.exports = mongoose.models.Scan || mongoose.model("Scan", scanSchema);

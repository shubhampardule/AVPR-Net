const mongoose = require("mongoose");

const scanSchema = new mongoose.Schema(
  {
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

module.exports = mongoose.model("Scan", scanSchema);

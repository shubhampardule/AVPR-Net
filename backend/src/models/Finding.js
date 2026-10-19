const mongoose = require("mongoose");

const findingSchema = new mongoose.Schema(
  {
    scan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Scan",
      required: true,
      index: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    owner: {
      type: String,
      required: true,
    },
    repo: {
      type: String,
      required: true,
    },
    filePath: {
      type: String,
      required: true,
    },
    startLine: {
      type: Number,
      required: true,
    },
    endLine: {
      type: Number,
      default: null,
    },
    column: {
      type: Number,
      default: null,
    },
    cwe: {
      type: String,
      default: "CWE-Unknown",
      index: true,
    },
    ruleId: {
      type: String,
      required: true,
    },
    scanner: {
      type: String,
      enum: ["semgrep", "bandit", "trivy"],
      required: true,
    },
    severity: {
      type: String,
      enum: ["critical", "high", "medium", "low", "info"],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: "",
    },
    evidenceSnippet: {
      type: String,
      maxlength: 1000,
      default: "",
    },
    remediation: {
      type: String,
      default: "",
    },
    fingerprint: {
      type: String,
      required: true,
      index: true,
    },
    riskScore: {
      type: Number,
      required: true,
      min: 0,
      max: 10,
    },
    riskFactors: {
      severity: { type: Number, required: true },
      exploitability: { type: Number, required: true },
      occurrence: { type: Number, required: true },
      businessImpact: { type: Number, required: true },
    },
    riskCategory: {
      type: String,
      enum: ["critical", "high", "medium", "low"],
      required: true,
    },
    status: {
      type: String,
      enum: ["open", "acknowledged", "resolved"],
      default: "open",
    },
  },
  {
    timestamps: true,
  }
);

findingSchema.index({ scan: 1, fingerprint: 1 });
findingSchema.index({ organization: 1, owner: 1, repo: 1 });

module.exports = mongoose.model("Finding", findingSchema);

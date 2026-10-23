const mongoose = require("mongoose");

const CHECK_NAMES = ["patch_integrity", "syntax", "allowed_tests", "security_rescan"];
const CHECK_STATUSES = ["passed", "failed", "skipped", "unavailable"];

const checkSchema = new mongoose.Schema({
  name: { type: String, enum: CHECK_NAMES, required: true, immutable: true },
  status: { type: String, enum: CHECK_STATUSES, required: true, immutable: true },
  method: { type: String, maxlength: 80, default: null, immutable: true },
  detailCode: { type: String, maxlength: 80, required: true, immutable: true },
}, { _id: false, strict: "throw" });

const remediationVerificationSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, immutable: true, index: true },
  scan: { type: mongoose.Schema.Types.ObjectId, ref: "Scan", required: true, immutable: true, index: true },
  finding: { type: mongoose.Schema.Types.ObjectId, ref: "Finding", required: true, immutable: true, index: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
  repository: { type: String, required: true, maxlength: 140, immutable: true },
  sourceCommitSha: { type: String, required: true, match: /^[a-f0-9]{40}$/i, immutable: true },
  targetPath: { type: String, required: true, maxlength: 500, immutable: true },
  patchSha256: { type: String, required: true, match: /^[a-f0-9]{64}$/, immutable: true },
  sourceSha256: { type: String, required: true, match: /^[a-f0-9]{64}$/, immutable: true },
  proposedSha256: { type: String, match: /^[a-f0-9]{64}$/, default: null, immutable: true },
  action: { type: String, enum: ["validation", "draft_pr"], required: true, immutable: true },
  securityRescan: {type:new mongoose.Schema({
    jobId:{type:mongoose.Schema.Types.ObjectId,required:true},
    rulesHash:{type:String,required:true,match:/^[a-f0-9]{64}$/},
    policyHash:{type:String,required:true,match:/^[a-f0-9]{64}$/},
  },{_id:false,strict:"throw"}),default:null,immutable:true},
  projectTests: {type:new mongoose.Schema({
    jobId:{type:mongoose.Schema.Types.ObjectId,required:true},profile:{type:String,required:true,maxlength:80},
    runnerRevision:{type:String,required:true,match:/^[a-f0-9]{40}$/},runUrl:{type:String,required:true,maxlength:300},
  },{_id:false,strict:"throw"}),default:null,immutable:true},
  checks: { type: [checkSchema], required: true, validate: value => value.length === CHECK_NAMES.length &&
    CHECK_NAMES.every(name => value.filter(check => check.name === name).length === 1), immutable: true },
  pullRequest: {
    number: { type: Number, min: 1, default: null, immutable: true },
    url: { type: String, maxlength: 300, default: null, immutable: true },
    branch: { type: String, maxlength: 200, default: null, immutable: true },
    baseSha: { type: String, match: /^[a-f0-9]{40}$/i, default: null, immutable: true },
  },
}, {
  timestamps: { createdAt: true, updatedAt: false },
  versionKey: false,
  strict: "throw",
});

remediationVerificationSchema.index({ organization: 1, scan: 1, finding: 1, createdAt: -1, _id: -1 });
remediationVerificationSchema.pre("save", function rejectVerificationMutation() {
  if (!this.isNew) throw new Error("Remediation verification records are append-only");
});
for (const operation of ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "deleteOne", "deleteMany", "findOneAndDelete"]) {
  remediationVerificationSchema.pre(operation, function rejectVerificationQueryMutation() {
    throw new Error("Remediation verification records are append-only");
  });
}

module.exports = mongoose.models.RemediationVerification || mongoose.model("RemediationVerification", remediationVerificationSchema);
module.exports.CHECK_NAMES = CHECK_NAMES;
module.exports.CHECK_STATUSES = CHECK_STATUSES;

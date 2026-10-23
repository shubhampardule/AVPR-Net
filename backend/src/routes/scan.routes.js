const express = require("express");
const { requireAuth } = require("../middleware/auth.middleware");
const { requireOrganizationMember } = require("../middleware/organization.middleware");
const { requireScanMember } = require("../middleware/scanAccess.middleware");
const {
  enqueueScan,
  getScanStatus,
  getScanFindings,
  listRepoScans,
} = require("../controllers/scan.controller");

const router = express.Router();
const handler = require("../utils/asyncHandler");
const workflow = require("../services/finding-workflow.service");
const Scan = require("../models/Scan");
const Finding = require("../models/Finding");
const { bad, objectId } = require("../utils/input");
const remediation = require("../services/remediation.service");
const remediationVerification = require("../services/remediation-verification.service");
const { recordAuditEvent } = require("../services/audit.service");
const logger = require("../config/logger");
async function findingContext(req) {
  objectId(req.params.findingId);
  const scan = await Scan.findById(req.params.scanId).lean();
  const finding = await Finding.findOne({ _id: req.params.findingId, scan: req.params.scanId }).lean();
  if (!scan || !finding) throw bad("Finding not found", 404);
  return { scan, finding };
}
router.post("/:scanId/findings/:findingId/project-tests",requireAuth,requireScanMember,handler(async(req,res)=>{
  const {scan,finding}=await findingContext(req);
  if(req.body?.acknowledged!==true)throw bad("Approve isolated execution of the repository tests before starting");
  const job=await require("../services/project-test-jobs.service").enqueue({scan,finding,patch:req.body?.patch,rescanJobId:req.body?.rescanJobId,actorId:req.user._id});
  res.status(202).json({success:true,data:{job}});
}));
router.get("/:scanId/findings/:findingId/project-tests/:jobId",requireAuth,requireScanMember,handler(async(req,res)=>{
  objectId(req.params.jobId);const {scan}=await findingContext(req);
  const job=await require("../services/project-test-jobs.service").get({_id:req.params.jobId,scan:scan._id,finding:req.params.findingId,organization:scan.organization});
  res.json({success:true,data:{job}});
}));
router.post("/:scanId/findings/:findingId/project-tests/:jobId/cancel",requireAuth,requireScanMember,handler(async(req,res)=>{
  objectId(req.params.jobId);const {scan}=await findingContext(req);
  const job=await require("../services/project-test-jobs.service").cancel({_id:req.params.jobId,scan:scan._id,finding:req.params.findingId,organization:scan.organization});
  res.json({success:true,data:{job}});
}));
router.get("/:scanId/findings/:findingId/source", requireAuth, requireScanMember, handler(async (req, res) => {
  const { scan, finding } = await findingContext(req);
  res.json({ success: true, data: await remediation.source(scan, finding) });
}));
router.post("/:scanId/findings/:findingId/validate", requireAuth, requireScanMember, handler(async (req, res) => {
  const { scan, finding } = await findingContext(req);
  await require("../services/budget.service").consume(`patch-validate:${scan.organization}`, 60, 3600000);
  let result;
  try {
    result = await remediation.validate(scan, finding, req.body?.patch, { allowSyntaxFailure: true });
  } catch (error) {
    if (error.code === "PATCH_INTEGRITY_FAILED" && error.validationContext) {
      try {
        await remediationVerification.recordFailedIntegrity({ scan, finding, actorId: req.user._id,
          patch: req.body?.patch, context: error.validationContext });
        res.setHeader("X-SecurePatch-Verification-Recorded", "true");
      } catch (recordError) {
        logger.error(`remediation_verification_write_failed action=validation request=${req.requestId || "unknown"} error=${recordError.name || "Error"}`);
        res.setHeader("X-SecurePatch-Verification-Recorded", "false");
      }
    }
    throw error;
  }
  const verification = await remediationVerification.recordVerification({ scan, finding, actorId: req.user._id,
    patch: req.body?.patch, validation: result, action: "validation" });
  res.setHeader("X-SecurePatch-Verification-Recorded", "true");
  res.json({ success: true, data: { applies: true, syntax: result.syntax, tests: "not_executed", verification } });
}));
router.post("/:scanId/findings/:findingId/pull-request", requireAuth, requireScanMember,
  require("../middleware/rbac.middleware").requireRole("owner", "admin"), handler(async (req, res) => {
    const { scan, finding } = await findingContext(req);
    const result = await remediation.createPullRequest(scan, finding, req.body || {});
    const { verificationMaterial, ...publicResult } = result;
    await recordAuditEvent(req, {
      organizationId: scan.organization,
      action: "pull_request.draft_created",
      target: `pull-request/${scan.owner}/${scan.repo}#${result.number}`,
      details: { repository: `${scan.owner}/${scan.repo}`, pullRequestNumber: result.number,
        pullRequestUrl: result.url, baseSha: result.baseSha || scan.commitSha },
    });
    let verification = null;
    try {
      verification = await remediationVerification.recordVerification({ scan, finding, actorId: req.user._id,
        patch: req.body?.patch, validation: verificationMaterial, action: "draft_pr", pullRequest: result });
      res.setHeader("X-SecurePatch-Verification-Recorded", "true");
    } catch (error) {
      logger.error(`remediation_verification_write_failed action=draft_pr request=${req.requestId || "unknown"} error=${error.name || "Error"}`);
      res.setHeader("X-SecurePatch-Verification-Recorded", "false");
    }
    res.status(201).json({ success: true, data: { ...publicResult, verification, verificationRecorded: Boolean(verification) } });
  }));
router.get("/:scanId/findings/:findingId/verifications", requireAuth, requireScanMember, handler(async (req, res) => {
  const { scan } = await findingContext(req);
  const verifications = await remediationVerification.listVerifications({ organizationId: scan.organization,
    scanId: scan._id, findingId: req.params.findingId, limit: 20 });
  res.json({ success: true, data: { verifications } });
}));
router.post("/:scanId/findings/:findingId/rescans",requireAuth,requireScanMember,handler(async(req,res)=>{
  const {scan,finding}=await findingContext(req);
  const job=await require("../services/patch-rescan-jobs.service").enqueue({scan,finding,patch:req.body?.patch,actorId:req.user._id});
  res.status(202).json({success:true,data:{job}});
}));
router.get("/:scanId/findings/:findingId/rescans/:jobId",requireAuth,requireScanMember,handler(async(req,res)=>{
  objectId(req.params.jobId);
  const {scan}=await findingContext(req);
  const job=await require("../services/patch-rescan-jobs.service").get({jobId:req.params.jobId,scanId:scan._id,
    findingId:req.params.findingId,organizationId:scan.organization});
  res.json({success:true,data:{job}});
}));
router.post("/:scanId/findings/:findingId/rescans/:jobId/cancel",requireAuth,requireScanMember,handler(async(req,res)=>{
  objectId(req.params.jobId);
  const {scan}=await findingContext(req);
  const job=await require("../services/patch-rescan-jobs.service").cancel({jobId:req.params.jobId,scanId:scan._id,
    findingId:req.params.findingId,organizationId:scan.organization});
  res.json({success:true,data:{job}});
}));
router.get("/organizations/:organizationId/findings", requireAuth, requireOrganizationMember, handler(async (req, res) => {
  objectId(req.params.organizationId);
  const { integer } = require("../utils/input");
  const page = integer(req.query.page, 1, 10000), limit = integer(req.query.limit, 25, 100);
  const organization = new (require("mongoose").Types.ObjectId)(req.params.organizationId);
  const [latest, latestActivity] = await Promise.all([
    Scan.aggregate([
      { $match: { organization, status: "completed", scannersUsed: { $exists: true, $ne: [] }, scannerErrors: { $size: 0 } } },
      { $sort: { createdAt: -1, _id: -1 } },
      { $group: { _id: { owner: { $toLower: "$owner" }, repo: { $toLower: "$repo" } }, scan: { $first: "$_id" }, commitSha: { $first: "$commitSha" } } },
    ]),
    Scan.aggregate([
      { $match: { organization } },
      { $sort: { createdAt: -1, _id: -1 } },
      { $group: { _id: { owner: { $toLower: "$owner" }, repo: { $toLower: "$repo" } }, scan: { $first: "$_id" }, status: { $first: "$status" } } },
    ]),
  ]);
  const key = item => `${item._id.owner}/${item._id.repo}`;
  const successfulByRepository = new Map(latest.map(scan => [key(scan), scan]));
  const latestFindingsFreshness = {
    repositoriesWithSuccessfulBaseline: latest.length,
    repositoriesUsingEarlierSuccessfulResult: latestActivity.filter(activity => {
      const successful = successfulByRepository.get(key(activity));
      return successful && String(successful.scan) !== String(activity.scan);
    }).length,
    repositoriesWithoutSuccessfulBaseline: latestActivity.filter(activity => !successfulByRepository.has(key(activity))).length,
  };
  const filter = { organization: req.params.organizationId, scan: { $in: latest.map(s => s.scan) }, status: { $nin: ["resolved", "dismissed"] } };
  if (req.query.riskCategory) {
    if (!["critical", "high", "medium", "low"].includes(req.query.riskCategory)) throw bad("Invalid risk category");
    filter.riskCategory = req.query.riskCategory;
  }
  const [findings, total] = await Promise.all([Finding.find(filter).populate("reviewHistory.reviewedBy", "name githubUsername").sort({ riskScore: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(), Finding.countDocuments(filter)]);
  res.json({ success: true, data: { findings, latestScans: latest, latestFindingsFreshness,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } } });
}));

router.get("/:scanId/comparison", requireAuth, requireScanMember, handler(async (req, res) => {
  res.json({ success: true, data: await workflow.compare(req.params.scanId) });
}));
router.get("/:scanId/export", requireAuth, requireScanMember, handler(async (req, res) => {
  const format = req.query.format || "json";
  const data = await workflow.exportScan(req.params.scanId, format);
  res.setHeader("Content-Disposition", `attachment; filename="scan-${req.params.scanId}.${format === "sarif" ? "sarif" : "json"}"`);
  res.json(data);
}));
router.post("/:scanId/cancel", requireAuth, requireScanMember, handler(async (req, res) => {
  const scan = await Scan.findOneAndUpdate({ _id: req.params.scanId, status: { $in: ["queued", "running"] } },
    { $set: { cancelledAt: new Date(), status: "failed", errorMessage: "Cancelled by organization member",
      activeKey: null, leaseUntil: null, leaseToken: null, completedAt: new Date() } }, { returnDocument: "after" });
  if (!scan) throw bad("No active scan to cancel", 409);
  await recordAuditEvent(req, {
    organizationId: scan.organization,
    action: "scan.cancelled",
    target: `scan/${scan._id}`,
    details: { repository: `${scan.owner}/${scan.repo}`, scanId: String(scan._id) },
  });
  res.json({ success: true, data: scan });
}));
router.patch("/:scanId/findings/:findingId", requireAuth, requireScanMember, handler(async (req, res) => {
  objectId(req.params.findingId);
  const { status, reason } = req.body || {};
  if (!["open", "acknowledged", "dismissed", "resolved"].includes(status) || typeof reason !== "string" || !reason.trim() || reason.length > 1000) throw bad("Choose a status and a review reason (1–1000 characters)");
  const reviewedAt = new Date();
  const finding = await Finding.findOneAndUpdate({ _id: req.params.findingId, scan: req.params.scanId },
    { $set: { status, statusReason: reason.trim(), reviewedBy: req.user._id, reviewedAt },
      $push: { reviewHistory: { status, reason: reason.trim(), reviewedBy: req.user._id, reviewedAt } } },
    { returnDocument: "after", runValidators: true });
  if (!finding) throw bad("Finding not found", 404);
  await recordAuditEvent(req, {
    organizationId: finding.organization,
    action: "finding.reviewed",
    target: `finding/${finding._id}`,
    details: { repository: `${finding.owner}/${finding.repo}`, scanId: String(finding.scan),
      findingId: String(finding._id), status },
  });
  res.json({ success: true, data: finding });
}));

// Enqueue a new scan for a repository
router.post(
  "/organizations/:organizationId/repositories/:owner/:repo",
  requireAuth,
  requireOrganizationMember,
  enqueueScan
);

// List scan history for a repository
router.get(
  "/organizations/:organizationId/repositories/:owner/:repo",
  requireAuth,
  requireOrganizationMember,
  listRepoScans
);

// Get status and summary of a scan
router.get("/:scanId", requireAuth, requireScanMember, getScanStatus);

// Get paginated findings of a scan
router.get("/:scanId/findings", requireAuth, requireScanMember, getScanFindings);

module.exports = router;

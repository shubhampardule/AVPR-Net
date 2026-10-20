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
async function findingContext(req) {
  objectId(req.params.findingId);
  const scan = await Scan.findById(req.params.scanId).lean();
  const finding = await Finding.findOne({ _id: req.params.findingId, scan: req.params.scanId }).lean();
  if (!scan || !finding) throw bad("Finding not found", 404);
  return { scan, finding };
}
router.get("/:scanId/findings/:findingId/source", requireAuth, requireScanMember, handler(async (req, res) => {
  const { scan, finding } = await findingContext(req);
  res.json({ success: true, data: await remediation.source(scan, finding) });
}));
router.post("/:scanId/findings/:findingId/validate", requireAuth, requireScanMember, handler(async (req, res) => {
  const { scan, finding } = await findingContext(req);
  const result = await remediation.validate(scan, finding, req.body?.patch);
  res.json({ success: true, data: { applies: true, syntax: result.syntax, tests: "not_executed" } });
}));
router.post("/:scanId/findings/:findingId/pull-request", requireAuth, requireScanMember,
  require("../middleware/rbac.middleware").requireRole("owner", "admin"), handler(async (req, res) => {
    const { scan, finding } = await findingContext(req);
    res.status(201).json({ success: true, data: await remediation.createPullRequest(scan, finding, req.body || {}) });
  }));
router.get("/organizations/:organizationId/findings", requireAuth, requireOrganizationMember, handler(async (req, res) => {
  objectId(req.params.organizationId);
  const { integer } = require("../utils/input");
  const page = integer(req.query.page, 1, 10000), limit = integer(req.query.limit, 25, 100);
  const latest = await Scan.aggregate([
    { $match: { organization: new (require("mongoose").Types.ObjectId)(req.params.organizationId), status: "completed", scannerErrors: { $size: 0 } } },
    { $sort: { createdAt: -1 } }, { $group: { _id: { owner: "$owner", repo: "$repo" }, scan: { $first: "$_id" }, commitSha: { $first: "$commitSha" } } },
  ]);
  const filter = { organization: req.params.organizationId, scan: { $in: latest.map(s => s.scan) }, status: { $nin: ["resolved", "dismissed"] } };
  if (req.query.riskCategory) {
    if (!["critical", "high", "medium", "low"].includes(req.query.riskCategory)) throw bad("Invalid risk category");
    filter.riskCategory = req.query.riskCategory;
  }
  const [findings, total] = await Promise.all([Finding.find(filter).sort({ riskScore: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(), Finding.countDocuments(filter)]);
  res.json({ success: true, data: { findings, latestScans: latest, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } } });
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
    { $set: { cancelledAt: new Date(), status: "failed", errorMessage: "Cancelled by organization member", activeKey: null, completedAt: new Date() } }, { returnDocument: "after" });
  if (!scan) throw bad("No active scan to cancel", 409);
  res.json({ success: true, data: scan });
}));
router.patch("/:scanId/findings/:findingId", requireAuth, requireScanMember, handler(async (req, res) => {
  objectId(req.params.findingId);
  const { status, reason } = req.body || {};
  if (!["open", "acknowledged", "dismissed", "resolved"].includes(status) || typeof reason !== "string" || !reason.trim() || reason.length > 1000) throw bad("Choose a status and a review reason (1–1000 characters)");
  const finding = await Finding.findOneAndUpdate({ _id: req.params.findingId, scan: req.params.scanId },
    { $set: { status, statusReason: reason.trim(), reviewedBy: req.user._id, reviewedAt: new Date() } }, { returnDocument: "after", runValidators: true });
  if (!finding) throw bad("Finding not found", 404);
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

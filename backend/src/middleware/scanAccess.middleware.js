const mongoose = require("mongoose");
const Scan = require("../models/Scan");
const OrganizationMember = require("../models/OrganizationMember");

async function requireScanMember(req, res, next) {
  try {
    const scanId = req.params.scanId;
    const scan = mongoose.isValidObjectId(scanId) ? await Scan.findById(scanId) : null;
    const membership = scan && await OrganizationMember.findOne({
      user: req.user._id, organization: scan.organization, status: "active",
    });
    if (!membership) return res.status(404).json({ success: false, error: {
      code: "SCAN_NOT_FOUND", message: "Scan not found in your organizations",
    } });
    req.organizationMembership = membership;
    next();
  } catch (error) { next(error); }
}

module.exports = { requireScanMember };

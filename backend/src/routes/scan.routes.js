const express = require("express");
const { requireAuth } = require("../middleware/auth.middleware");
const { requireOrganizationMember } = require("../middleware/organization.middleware");
const {
  enqueueScan,
  getScanStatus,
  getScanFindings,
  listRepoScans,
} = require("../controllers/scan.controller");

const router = express.Router();

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
router.get("/:scanId", requireAuth, getScanStatus);

// Get paginated findings of a scan
router.get("/:scanId/findings", requireAuth, getScanFindings);

module.exports = router;

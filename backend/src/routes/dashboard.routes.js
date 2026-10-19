const express = require("express");
const { requireAuth } = require("../middleware/auth.middleware");
const { requireOrganizationMember } = require("../middleware/organization.middleware");
const { getOrganizationOverview } = require("../controllers/dashboard.controller");

const router = express.Router();

router.get(
  "/organizations/:organizationId",
  requireAuth,
  requireOrganizationMember,
  getOrganizationOverview
);

module.exports = router;

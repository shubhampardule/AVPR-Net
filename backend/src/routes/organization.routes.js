const express = require("express");
const {
  createOrganization,
  getMyOrganizations,
  getOrganization,
} = require("../controllers/organization.controller");
const {
  requireOrganizationMember,
} = require("../middleware/organization.middleware");

const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/", requireAuth, createOrganization);
router.get("/", requireAuth, getMyOrganizations);
router.get("/:organizationId", requireAuth, requireOrganizationMember, getOrganization);


module.exports = router;
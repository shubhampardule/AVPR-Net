const express = require("express");
const healthRoutes = require("./health.routes");
const authRoutes = require("./auth.routes");
const organizationRoutes = require("./organization.routes");
const memberRoutes = require("./member.routes");
const githubRoutes = require("./github.routes");
const scanRoutes = require("./scan.routes");
const dashboardRoutes = require("./dashboard.routes");

const router = express.Router();
router.use("/internal/project-tests", require("./project-test-runner.routes"));
router.use(require("./automation.routes"));
router.use(require("./invitation-email-webhook.routes"));

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/organizations", organizationRoutes);
router.use("/organizations", memberRoutes);
router.use("/organizations", require("./notification.routes"));
router.use("/github", githubRoutes);
router.use("/scans", scanRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/organizations/:organizationId/ai", require("./assistant.routes").createAssistantRouter());

module.exports = router;

const express = require("express");
const { createAssistantRouter } = require("./assistant.routes");
const router = express.Router();
router.use("/health", require("./health.routes"));
router.use("/ai/demo", createAssistantRouter({ demo: true }));
module.exports = router;

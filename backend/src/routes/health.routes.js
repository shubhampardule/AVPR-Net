const express = require("express");
const { healthCheck } = require("../controllers/health.controller");

const router = express.Router();

router.get("/", healthCheck);
router.get("/ready", require("../middleware/auth.middleware").requireAuth, require("../utils/asyncHandler")(async (req, res) => {
  const worker = await require("../models/UsageBucket").findById("worker:bom1").lean();
  const oldest = await require("../models/Scan").findOne({ status: "queued" }).sort({ createdAt: 1 }).select("createdAt").lean();
  res.json({ success: true, data: { database: "connected", workerAvailable: Boolean(worker?.expires > new Date()),
    oldestQueuedAgeMs: oldest ? Date.now() - new Date(oldest.createdAt).getTime() : null,
    revision: process.env.VERCEL_GIT_COMMIT_SHA || null } });
}));

module.exports = router;

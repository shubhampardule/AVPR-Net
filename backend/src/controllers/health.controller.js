const ApiResponse = require("../utils/ApiResponse");
const { NvidiaService } = require("../services/nvidia.service");
const mongoose = require("mongoose");

const healthCheck = (req, res) => {
  return ApiResponse.success(
    res,
    {
      status: "ok",
      service: "securepatch-backend",
      revision: process.env.VERCEL_GIT_COMMIT_SHA || null,
      database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
      ai: new NvidiaService().health(),
    },
    "SecurePatch backend is healthy"
  );
};

module.exports = {
  healthCheck,
};

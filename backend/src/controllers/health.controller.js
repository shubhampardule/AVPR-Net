const ApiResponse = require("../utils/ApiResponse");
const { NvidiaService } = require("../services/nvidia.service");

const healthCheck = (req, res) => {
  return ApiResponse.success(
    res,
    {
      status: "ok",
      service: "securepatch-backend",
      ai: new NvidiaService().health(),
    },
    "SecurePatch backend is healthy"
  );
};

module.exports = {
  healthCheck,
};

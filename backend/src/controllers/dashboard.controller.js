const DashboardService = require("../services/dashboard.service");
const ApiResponse = require("../utils/ApiResponse");

const getOrganizationOverview = async (req, res, next) => {
  try {
    const overview = await DashboardService.getOrganizationOverview(
      req.params.organizationId
    );
    return ApiResponse.success(
      res,
      overview,
      "Organization dashboard retrieved successfully"
    );
  } catch (error) {
    next(error);
  }
};

module.exports = { getOrganizationOverview };

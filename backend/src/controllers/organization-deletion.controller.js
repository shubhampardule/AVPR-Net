const ApiResponse = require("../utils/ApiResponse");
const { bad } = require("../utils/input");
const { requestOrganizationDeletion } = require("../services/organization-deletion.service");
async function deleteOrganization(req, res, next) {
  try {
    if (!req.body || Object.keys(req.body).length !== 1 || typeof req.body.confirmation !== "string") throw bad("Provide only the exact organization name as confirmation");
    const data = await requestOrganizationDeletion({ organizationId: req.params.organizationId, actorId: req.user._id, confirmation: req.body.confirmation });
    return ApiResponse.success(res, data, "Organization access removed; data erasure queued", 202);
  } catch (error) { next(error); }
}
module.exports = { deleteOrganization };

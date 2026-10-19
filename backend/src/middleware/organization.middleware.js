const OrganizationMember = require("../models/OrganizationMember");

const requireOrganizationMember = async (req, res, next) => {
    try {
        const { organizationId } = req.params;

        if (!organizationId) {
            return res.status(400).json({
                success: false,
                error: {
                    code: "ORGANIZATION_ID_REQUIRED",
                    message: "Organization ID is required",
                },
            });
        }

        const membership = await OrganizationMember.findOne({
            user: req.user._id,
            organization: organizationId,
            status: "active",
        });

        if (!membership) {
            return res.status(403).json({
                success: false,
                error: {
                    code: "ORGANIZATION_ACCESS_DENIED",
                    message: "You are not a member of this organization",
                },
            });
        }

        req.organizationMembership = membership;
        next();
    } catch (error) {
        next(error);
    }
};

module.exports = {
    requireOrganizationMember,
};
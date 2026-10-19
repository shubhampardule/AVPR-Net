const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        const membership = req.organizationMembership;

        if (!membership) {
            return res.status(403).json({
                success: false,
                error: {
                    code: "ORGANIZATION_ACCESS_DENIED",
                    message: "Organization membership is required",
                },
            });
        }

        if (!allowedRoles.includes(membership.role)) {
            return res.status(403).json({
                success: false,
                error: {
                    code: "INSUFFICIENT_PERMISSIONS",
                    message: "You do not have permission to perform this action",
                },
            });
        }

        next();
    };
};

module.exports = {
    requireRole,
};
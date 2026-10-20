const OrganizationMember = require("../models/OrganizationMember");
const ApiResponse = require("../utils/ApiResponse");

const getMembers = async (req, res, next) => {
    try {
        const members = await OrganizationMember.find({
            organization: req.params.organizationId,
            status: "active",
        }).populate("user", "name email profileImage");

        const data = members.map((member) => ({
            user: {
                id: member.user._id,
                name: member.user.name,
                email: member.user.email,
                profileImage: member.user.profileImage,
            },
            role: member.role,
            status: member.status,
        }));

        return ApiResponse.success(
            res,
            { members: data },
            "Organization members retrieved successfully"
        );
    } catch (error) {
        next(error);
    }
};

const updateMemberRole = async (req, res, next) => {
    try {
        const { organizationId, userId } = req.params;
        const { role } = req.body;

        const allowedRoles = ["admin", "developer"];

        if (!role || !allowedRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: "INVALID_ROLE",
                    message: "Role must be admin or developer",
                },
            });
        }

        const membership = await OrganizationMember.findOne({
            user: userId,
            organization: organizationId,
            status: "active",
        });

        if (!membership) {
            return res.status(404).json({
                success: false,
                error: {
                    code: "MEMBERSHIP_NOT_FOUND",
                    message: "Organization membership not found",
                },
            });
        }

        if (membership.role === "owner") {
            return res.status(403).json({
                success: false,
                error: {
                    code: "OWNER_ROLE_PROTECTED",
                    message: "Owner role cannot be changed using this endpoint",
                },
            });
        }

        membership.role = role;
        await membership.save();

        return ApiResponse.success(
            res,
            {
                member: {
                    userId: membership.user,
                    role: membership.role,
                    status: membership.status,
                },
            },
            "Member role updated successfully"
        );
    } catch (error) {
        next(error);
    }
};

const removeMember = async (req, res, next) => {
    try {
        const { organizationId, userId } = req.params;

        const membership = await OrganizationMember.findOne({
            user: userId,
            organization: organizationId,
            status: "active",
        });

        if (!membership) {
            return res.status(404).json({
                success: false,
                error: {
                    code: "MEMBERSHIP_NOT_FOUND",
                    message: "Organization membership not found",
                },
            });
        }

        if (membership.role === "owner") {
            return res.status(403).json({
                success: false,
                error: {
                    code: "OWNER_CANNOT_BE_REMOVED",
                    message: "Organization owner cannot be removed",
                },
            });
        }

        membership.status = "suspended";
        await membership.save();

        return ApiResponse.success(
            res,
            null,
            "Member removed successfully"
        );
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getMembers,
    updateMemberRole,
    removeMember,
};

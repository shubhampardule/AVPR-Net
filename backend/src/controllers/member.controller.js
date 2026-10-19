const User = require("../models/User");
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

const addMember = async (req, res, next) => {
    try {
        const { email, role } = req.body;

        if (!email || !email.trim()) {
            return res.status(400).json({
                success: false,
                error: {
                    code: "EMAIL_REQUIRED",
                    message: "Member email is required",
                },
            });
        }

        const allowedRoles = ["admin", "developer"];

        if (!role || !allowedRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: "INVALID_ROLE",
                    message: "Member role must be admin or developer",
                },
            });
        }

        const user = await User.findOne({
            email: email.toLowerCase().trim(),
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: {
                    code: "USER_NOT_FOUND",
                    message: "No SecurePatch user found with this email",
                },
            });
        }

        const existingMembership = await OrganizationMember.findOne({
            user: user._id,
            organization: req.params.organizationId,
        });

        if (existingMembership) {
            return res.status(409).json({
                success: false,
                error: {
                    code: "MEMBERSHIP_EXISTS",
                    message: "User is already a member of this organization",
                },
            });
        }

        const membership = await OrganizationMember.create({
            user: user._id,
            organization: req.params.organizationId,
            role,
            status: "active",
        });

        return ApiResponse.success(
            res,
            {
                member: {
                    user: {
                        id: user._id,
                        name: user.name,
                        email: user.email,
                        profileImage: user.profileImage,
                    },
                    role: membership.role,
                    status: membership.status,
                },
            },
            "Member added successfully",
            201
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

        membership.status = "inactive";
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
    addMember,
    updateMemberRole,
    removeMember,
};
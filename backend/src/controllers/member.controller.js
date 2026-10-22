const OrganizationMember = require("../models/OrganizationMember");
const Organization = require("../models/Organization");
const mongoose = require("mongoose");
const ApiResponse = require("../utils/ApiResponse");
const { recordAuditEvent } = require("../services/audit.service");
const { bad, objectId } = require("../utils/input");

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

        const previousRole = membership.role;
        membership.role = role;
        await membership.save();
        await recordAuditEvent(req, {
            action: "member.role_changed",
            target: `member/${membership.user}`,
            details: { memberId: String(membership.user), fromRole: previousRole, toRole: role },
        });

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
        await recordAuditEvent(req, {
            action: "member.removed",
            target: `member/${membership.user}`,
            details: { memberId: String(membership.user), previousRole: membership.role },
        });

        return ApiResponse.success(
            res,
            null,
            "Member removed successfully"
        );
    } catch (error) {
        next(error);
    }
};

const transferOwnership = async (req, res, next) => {
    try {
        const { organizationId } = req.params;
        const body = req.body || {};
        if (Object.keys(body).length !== 2 || typeof body.newOwnerId !== "string" || typeof body.confirmation !== "string") {
            throw bad("Provide a newOwnerId and the exact organization name to confirm the transfer");
        }
        const newOwnerId = objectId(body.newOwnerId);
        if (String(newOwnerId) === String(req.user._id)) throw bad("Choose another active organization member as the new owner");

        const organization = await Organization.findOne({ _id: organizationId, status: "active" }).select("name").lean();
        if (!organization) throw bad("Organization not found", 404, "ORGANIZATION_NOT_FOUND");
        if (body.confirmation !== organization.name) throw bad("Enter the organization name exactly to confirm the ownership transfer");

        let transferredMember;
        await mongoose.connection.transaction(async session => {
            const previousOwner = await OrganizationMember.findOneAndUpdate({
                _id: req.organizationMembership._id,
                user: req.user._id,
                organization: organizationId,
                status: "active",
                role: "owner",
            }, { $set: { role: "admin" } }, { session, returnDocument: "after", runValidators: true });
            if (!previousOwner) throw bad("Your owner role changed. Refresh the workspace and try again.", 409, "OWNER_ROLE_CHANGED");

            transferredMember = await OrganizationMember.findOneAndUpdate({
                user: newOwnerId,
                organization: organizationId,
                status: "active",
                role: { $in: ["admin", "developer"] },
            }, { $set: { role: "owner" } }, { session, returnDocument: "after", runValidators: true });
            if (!transferredMember) throw bad("The new owner must be an active admin or developer in this organization", 409, "NEW_OWNER_NOT_ELIGIBLE");
        });

        await recordAuditEvent(req, {
            action: "member.ownership_transferred",
            target: `member/${newOwnerId}`,
            details: { previousOwnerId: String(req.user._id), newOwnerId: String(newOwnerId) },
        });
        return ApiResponse.success(res, {
            newOwner: { userId: String(transferredMember.user), role: "owner" },
            currentUserRole: "admin",
        }, "Organization ownership transferred successfully");
    } catch (error) {
        next(error);
    }
};

const leaveOrganization = async (req, res, next) => {
    try {
        const { organizationId } = req.params;
        if (req.organizationMembership.role === "owner") {
            throw bad("Transfer ownership to another active member before leaving this organization", 409, "OWNER_MUST_TRANSFER");
        }

        let departedMembership;
        await mongoose.connection.transaction(async session => {
            departedMembership = await OrganizationMember.findOneAndUpdate({
                _id: req.organizationMembership._id,
                user: req.user._id,
                organization: organizationId,
                status: "active",
                role: { $in: ["admin", "developer"] },
            }, { $set: { status: "suspended" } }, { session, returnDocument: "after", runValidators: true });
            if (!departedMembership) {
                throw bad("Your organization membership changed. Refresh the workspace and try again", 409, "MEMBERSHIP_CHANGED");
            }

            const activeOwner = await OrganizationMember.findOne({
                organization: organizationId,
                status: "active",
                role: "owner",
            }).session(session).select("_id").lean();
            if (!activeOwner) {
                throw bad("This organization has no active owner. Contact an administrator before leaving", 409, "ACTIVE_OWNER_REQUIRED");
            }
        });

        await recordAuditEvent(req, {
            action: "member.left",
            target: `member/${req.user._id}`,
            details: { memberId: String(req.user._id), previousRole: departedMembership.role },
        });
        return ApiResponse.success(res, { organizationId, status: "suspended" }, "You left the organization");
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getMembers,
    updateMemberRole,
    removeMember,
    transferOwnership,
    leaveOrganization,
};

const Organization = require("../models/Organization");
const OrganizationMember = require("../models/OrganizationMember");
const ApiResponse = require("../utils/ApiResponse");

const createOrganization = async (req, res, next) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_ORGANIZATION_NAME",
          message: "Organization name is required",
        },
      });
    }

    const trimmedName = name.trim();

    const slug = trimmedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!slug) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_ORGANIZATION_NAME",
          message: "Organization name is invalid",
        },
      });
    }

    const existingOrganization = await Organization.findOne({
      slug,
    });

    if (existingOrganization) {
      return res.status(409).json({
        success: false,
        error: {
          code: "ORGANIZATION_EXISTS",
          message: "An organization with this name already exists",
        },
      });
    }

    const organization = await Organization.create({
      name: trimmedName,
      slug,
    });

    await OrganizationMember.create({
      user: req.user._id,
      organization: organization._id,
      role: "owner",
      status: "active",
    });

    return ApiResponse.success(
      res,
      {
        organization: {
          id: organization._id,
          name: organization.name,
          slug: organization.slug,
          status: organization.status,
        },
        role: "owner",
      },
      "Organization created successfully",
      201
    );
  } catch (error) {
    next(error);
  }
};

const getMyOrganizations = async (req, res, next) => {
  try {
    const memberships = await OrganizationMember.find({
      user: req.user._id,
      status: "active",
    }).populate("organization");

    const organizations = memberships
      .filter((membership) => membership.organization)
      .map((membership) => ({
        id: membership.organization._id,
        name: membership.organization.name,
        slug: membership.organization.slug,
        status: membership.organization.status,
        role: membership.role,
      }));

    return ApiResponse.success(
      res,
      {
        organizations,
      },
      "Organizations retrieved successfully"
    );
  } catch (error) {
    next(error);
  }
};

const getOrganization = async (req, res, next) => {
  try {
    const organization = await Organization.findById(
      req.params.organizationId
    );

    if (!organization) {
      return res.status(404).json({
        success: false,
        error: {
          code: "ORGANIZATION_NOT_FOUND",
          message: "Organization not found",
        },
      });
    }

    return ApiResponse.success(
      res,
      {
        organization: {
          id: organization._id,
          name: organization.name,
          slug: organization.slug,
          status: organization.status,
        },
        role: req.organizationMembership.role,
      },
      "Organization retrieved successfully"
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrganization,
  getMyOrganizations,
  getOrganization,
};
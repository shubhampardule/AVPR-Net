const Organization = require("../models/Organization");
const OrganizationMember = require("../models/OrganizationMember");
const ApiResponse = require("../utils/ApiResponse");
const { recordAuditEvent } = require("../services/audit.service");
const { buildOrganizationExport } = require("../services/organization-export.service");

const createOrganization = async (req, res, next) => {
  try {
    const { name } = req.body;

    if (typeof name !== "string" || !name.trim() || name.trim().length > 150) {
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

    let organization;
    await require("mongoose").connection.transaction(async (session) => {
      await require("../services/account-lock.service").lockActiveAccount(req.user._id, session);
      [organization] = await Organization.create([{ name: trimmedName, slug }], { session });
      await OrganizationMember.create([{ user: req.user._id, organization: organization._id,
        role: "owner", status: "active" }], { session });
    });
    await recordAuditEvent(req, {
      organizationId: organization._id,
      action: "organization.created",
      target: `organization/${organization._id}`,
      details: { organizationName: organization.name, slug: organization.slug },
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
      .filter((membership) => membership.organization?.status === "active")
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

const getAiSettings = async (req, res, next) => {
  try {
    const organization = await Organization.findById(req.params.organizationId).select("hostedAiEnabled").lean();
    if (!organization) return res.status(404).json({ success: false,
      error: { code: "ORGANIZATION_NOT_FOUND", message: "Organization not found" } });
    // A missing field means this organization predates the explicit opt-in.
    // Preserve its existing hosted-AI behavior; newly created orgs store false.
    return ApiResponse.success(res, { hostedAiEnabled: organization.hostedAiEnabled !== false });
  } catch (error) { next(error); }
};

const updateAiSettings = async (req, res, next) => {
  try {
    if (!req.body || Object.keys(req.body).length !== 1 || typeof req.body.hostedAiEnabled !== "boolean") {
      return res.status(400).json({ success: false,
        error: { code: "INVALID_AI_SETTINGS", message: "Provide only a boolean hostedAiEnabled value" } });
    }
    const organization = await Organization.findOneAndUpdate(
      { _id: req.params.organizationId, status: "active" },
      { $set: { hostedAiEnabled: req.body.hostedAiEnabled } },
      { new: true, runValidators: true }
    ).select("hostedAiEnabled");
    if (!organization) return res.status(404).json({ success: false,
      error: { code: "ORGANIZATION_NOT_FOUND", message: "Organization not found" } });
    await recordAuditEvent(req, {
      action: "ai.settings_changed",
      target: `organization/${req.params.organizationId}/hosted-ai`,
      details: { hostedAiEnabled: organization.hostedAiEnabled === true },
    });
    return ApiResponse.success(res, { hostedAiEnabled: organization.hostedAiEnabled });
  } catch (error) { next(error); }
};

const exportOrganization = async (req, res, next) => {
  try {
    const exported = await buildOrganizationExport(req.params.organizationId);
    if (!exported) {
      return res.status(404).json({ success: false,
        error: { code: "ORGANIZATION_NOT_FOUND", message: "Organization not found" } });
    }

    await recordAuditEvent(req, {
      action: "organization.exported",
      target: `organization/${req.params.organizationId}`,
      details: { recordCount: exported.counts.total },
    });

    const date = new Date().toISOString().slice(0, 10);
    const slug = String(exported.organization.slug || "organization").replace(/[^a-z0-9-]/gi, "-").slice(0, 100);
    const filename = `securepatch-${slug}-export-${date}.json`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.type("application/json");
    return res.send(JSON.stringify(exported, null, 2));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrganization,
  getMyOrganizations,
  getOrganization,
  getAiSettings,
  updateAiSettings,
  exportOrganization,
};

const Organization = require("../models/Organization");
const { githubApp } = require("../config/github");

const connectGitHubInstallation = async (req, res, next) => {
  try {
    const { organizationId } = req.params;
    const { installationId } = req.body;

    if (!installationId) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INSTALLATION_ID_REQUIRED",
          message: "GitHub installation ID is required",
        },
      });
    }

    const organization = await Organization.findById(organizationId);

    if (!organization) {
      return res.status(404).json({
        success: false,
        error: {
          code: "ORGANIZATION_NOT_FOUND",
          message: "Organization not found",
        },
      });
    }

    const { data: installation } = await githubApp.octokit.request(
      "GET /app/installations/{installation_id}",
      {
        installation_id: installationId,
      }
    );

    organization.githubInstallationId = String(installation.id);
    await organization.save();

    return res.status(200).json({
      success: true,
      data: {
        organizationId: organization.id,
        githubInstallationId: organization.githubInstallationId,
        account: installation.account?.login || null,
        accountType: installation.account?.type || null,
        htmlUrl: installation.html_url || null,
      },
      message: "GitHub connected successfully",
    });
  } catch (error) {
    next(error);
  }
};

const getGitHubStatus = async (req, res, next) => {
  try {
    const { organizationId } = req.params;

    const organization = await Organization.findById(organizationId);

    if (!organization) {
      return res.status(404).json({
        success: false,
        error: {
          code: "ORGANIZATION_NOT_FOUND",
          message: "Organization not found",
        },
      });
    }

    if (!organization.githubInstallationId) {
      return res.status(200).json({
        success: true,
        data: {
          connected: false,
          installation: null,
        },
        message: "GitHub is not connected",
      });
    }

    const { data: installation } = await githubApp.octokit.request(
      "GET /app/installations/{installation_id}",
      {
        installation_id: organization.githubInstallationId,
      }
    );

    return res.status(200).json({
      success: true,
      data: {
        connected: true,
        installation: {
          id: installation.id,
          account: installation.account?.login || null,
          accountType: installation.account?.type || null,
          htmlUrl: installation.html_url || null,
        },
      },
      message: "GitHub status fetched successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  connectGitHubInstallation,
  getGitHubStatus,
};
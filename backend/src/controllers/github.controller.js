const Organization = require("../models/Organization");
const { githubApp } = require("../config/github");
const { authorizedInstallations } = require("./githubAuth.controller");
const { recordAuditEvent } = require("../services/audit.service");

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

    if (!authorizedInstallations(req).some((item) => String(item.id) === String(installationId))) {
      return res.status(403).json({ success: false, error: {
        code: "GITHUB_AUTHORIZATION_REQUIRED",
        message: "Sign in with the GitHub account that manages this installation before connecting it.",
      } });
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
    await recordAuditEvent(req, {
      action: "github.installation_connected",
      target: `github-installation/${installation.id}`,
      details: { installationId: String(installation.id), account: installation.account?.login || "unknown",
        accountType: installation.account?.type || "unknown" },
    });

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

    let installation;
    try {
      ({ data: installation } = await githubApp.octokit.request(
        "GET /app/installations/{installation_id}",
        { installation_id: organization.githubInstallationId }
      ));
    } catch (error) {
      if (error.status !== 404) throw error;

      const revokedInstallationId = String(organization.githubInstallationId);
      organization.githubInstallationId = null;
      await organization.save();
      if (Array.isArray(req.session?.githubAccess?.installations)) {
        req.session.githubAccess.installations = req.session.githubAccess.installations
          .filter((item) => String(item.id) !== revokedInstallationId);
        await new Promise((resolve, reject) => req.session.save((saveError) => saveError ? reject(saveError) : resolve()));
      }
      await recordAuditEvent(req, {
        action: "github.installation_disconnected",
        target: `github-installation/${revokedInstallationId}`,
        details: { installationId: revokedInstallationId, reason: "revoked" },
      });
      return res.status(200).json({
        success: true,
        data: { connected: false, installation: null, revoked: true, revokedInstallationId },
        message: "GitHub App access was removed. Reinstall it to restore repository access.",
      });
    }

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

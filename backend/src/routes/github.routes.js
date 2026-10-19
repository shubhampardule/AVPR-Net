const express = require("express");

const { githubApp } = require("../config/github");
const { requireAuth } = require("../middleware/auth.middleware");
const { requireOrganizationMember } = require("../middleware/organization.middleware");
const { requireRole } = require("../middleware/rbac.middleware");

const { connectGitHubInstallation, getGitHubStatus } = require("../controllers/github.controller");

const { getRepositories, getRepositoryFiles, getFileContent } = require("../services/github.service");

const Organization = require("../models/Organization");

const router = express.Router();

// GitHub App authentication test
router.get("/test", async (req, res, next) => {
    try {
        const { data } = await githubApp.octokit.request("GET /app");

        return res.status(200).json({
            success: true,
            data: {
                id: data.id,
                name: data.name,
                slug: data.slug,
            },
            message: "GitHub App authentication successful",
        });
    } catch (error) {
        next(error);
    }
});

// Get GitHub App installations
router.get("/installations", async (req, res, next) => {
    try {
        const { data } = await githubApp.octokit.request("GET /app/installations");

        return res.status(200).json({
            success: true,
            data: data.map((installation) => ({
                id: installation.id,
                account: installation.account?.login,
                accountType: installation.account?.type,
                htmlUrl: installation.html_url || null,
            })),
            message: "GitHub App installations fetched successfully",
        });
    } catch (error) {
        next(error);
    }
});

// Get GitHub connection status
router.get(
    "/organizations/:organizationId/status",
    requireAuth,
    requireOrganizationMember,
    getGitHubStatus
);

// Get repositories for the authenticated organization's GitHub installation
router.get(
    "/organizations/:organizationId/repositories",
    requireAuth,
    requireOrganizationMember,
    async (req, res, next) => {
        try {
            const organization = await Organization.findById(req.params.organizationId);

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
                return res.status(404).json({
                    success: false,
                    error: {
                        code: "GITHUB_NOT_CONNECTED",
                        message: "GitHub is not connected to this organization",
                    },
                });
            }

            const repositories = await getRepositories(organization.githubInstallationId);

            return res.status(200).json({
                success: true,
                data: {
                    totalCount: repositories.length,
                    repositories,
                },
                message: "GitHub repositories fetched successfully",
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get files from a repository
router.get(
    "/organizations/:organizationId/repositories/:owner/:repo/files",
    requireAuth,
    requireOrganizationMember,
    async (req, res, next) => {
        try {
            const organization = await Organization.findById(req.params.organizationId);

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
                return res.status(404).json({
                    success: false,
                    error: {
                        code: "GITHUB_NOT_CONNECTED",
                        message: "GitHub is not connected to this organization",
                    },
                });
            }

            const { owner, repo } = req.params;

            const files = await getRepositoryFiles(
                organization.githubInstallationId,
                owner,
                repo
            );

            return res.status(200).json({
                success: true,
                data: {
                    repository: `${owner}/${repo}`,
                    files,
                },
                message: "Repository files fetched successfully",
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get content of a repository file
router.get(
    "/organizations/:organizationId/repositories/:owner/:repo/file",
    requireAuth,
    requireOrganizationMember,
    async (req, res, next) => {
        try {
            const organization = await Organization.findById(req.params.organizationId);

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
                return res.status(404).json({
                    success: false,
                    error: {
                        code: "GITHUB_NOT_CONNECTED",
                        message: "GitHub is not connected to this organization",
                    },
                });
            }

            const { owner, repo } = req.params;
            const { path: filePath } = req.query;

            if (!filePath) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: "FILE_PATH_REQUIRED",
                        message: "File path is required",
                    },
                });
            }

            const file = await getFileContent(
                organization.githubInstallationId,
                owner,
                repo,
                filePath
            );

            return res.status(200).json({
                success: true,
                data: file,
                message: "Repository file fetched successfully",
            });
        } catch (error) {
            next(error);
        }
    }
);

// Connect GitHub installation to organization
router.post(
    "/organizations/:organizationId/connect",
    requireAuth,
    requireOrganizationMember,
    requireRole("owner", "admin"),
    connectGitHubInstallation
);

module.exports = router;
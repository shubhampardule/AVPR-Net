const Organization = require("../models/Organization");
const Scan = require("../models/Scan");
const Finding = require("../models/Finding");
const { getRepositories } = require("./github.service");

const RECENT_SCAN_LIMIT = 6;
const PRIORITY_FINDING_LIMIT = 8;
const RECENT_SCANNER_SCAN_LIMIT = 20;
const emptyRiskDistribution = () => ({ critical: 0, high: 0, medium: 0, low: 0 });

class DashboardService {
  static async getOrganizationOverview(organizationId) {
    const organization = await Organization.findById(organizationId).lean();
    if (!organization) {
      const error = new Error("Organization not found");
      error.statusCode = 404;
      error.code = "ORGANIZATION_NOT_FOUND";
      throw error;
    }

    const organizationKey = organization._id;
    const [latestSuccessfulScans, latestScans] = await Promise.all([
      Scan.aggregate([
        { $match: { organization: organizationKey, status: "completed", scannersUsed: { $exists: true, $ne: [] }, scannerErrors: { $size: 0 } } },
        { $sort: { createdAt: -1, _id: -1 } },
        { $group: { _id: { owner: { $toLower: "$owner" }, repo: { $toLower: "$repo" } }, scan: { $first: "$_id" } } },
      ]),
      Scan.aggregate([
        { $match: { organization: organizationKey } },
        { $sort: { createdAt: -1, _id: -1 } },
        { $group: { _id: { owner: { $toLower: "$owner" }, repo: { $toLower: "$repo" } }, scan: { $first: "$_id" }, status: { $first: "$status" },
          scannerErrors: { $first: "$scannerErrors" } } },
      ]),
    ]);
    const repositoryKey = scan => `${String(scan._id.owner).toLowerCase()}/${String(scan._id.repo).toLowerCase()}`;
    const successfulByRepository = new Map(latestSuccessfulScans.map(scan => [repositoryKey(scan), scan]));
    const currentScanIds = latestSuccessfulScans.map(scan => scan.scan);
    const currentFindingFilter = { organization: organizationKey, scan: { $in: currentScanIds }, status: { $nin: ["resolved", "dismissed"] } };

    const [scansCount, historicalFindingsCount, historicalRiskGroups, currentFindingsCount, currentRiskGroups,
      recentScans, priorityFindings, scannerScans] = await Promise.all([
      Scan.countDocuments({ organization: organizationId }),
      Finding.countDocuments({ organization: organizationId }),
      Finding.aggregate([
        { $match: { organization: organizationKey } },
        { $group: { _id: "$riskCategory", count: { $sum: 1 } } },
      ]),
      Finding.countDocuments(currentFindingFilter),
      Finding.aggregate([
        { $match: currentFindingFilter },
        { $group: { _id: "$riskCategory", count: { $sum: 1 } } },
      ]),
      Scan.find({ organization: organizationId })
        .sort({ createdAt: -1 })
        .limit(RECENT_SCAN_LIMIT)
        .select("owner repo status summary createdAt startedAt completedAt scannersUsed scannerErrors")
        .lean(),
      Finding.find(currentFindingFilter)
        .sort({ riskScore: -1, createdAt: -1, _id: -1 })
        .limit(PRIORITY_FINDING_LIMIT)
        .select("owner repo filePath startLine cwe ruleId scanner severity title riskScore riskCategory createdAt scan")
        .lean(),
      Scan.find({
        organization: organizationId,
        $or: [
          { scannersUsed: { $exists: true, $ne: [] } },
          { scannerErrors: { $exists: true, $ne: [] } },
        ],
      })
        .sort({ createdAt: -1 })
        .limit(RECENT_SCANNER_SCAN_LIMIT)
        .select("scannersUsed scannerErrors createdAt")
        .lean(),
    ]);

    let repositories = null;
    let integrationWarning = null;
    if (organization.githubInstallationId) {
      try { repositories = await getRepositories(organization.githubInstallationId); }
      catch { integrationWarning = "GitHub is temporarily unavailable. Stored scan data remains available."; }
    }

    const knownRepositoryKeys = new Set(latestScans.map(repositoryKey));
    for (const repository of repositories || []) {
      if (repository.owner && repository.name) {
        knownRepositoryKeys.add(`${String(repository.owner).toLowerCase()}/${String(repository.name).toLowerCase()}`);
      }
    }
    const currentFindingsStatus = {
      repositoriesWithScans: latestScans.length,
      repositoriesWithSuccessfulBaseline: latestSuccessfulScans.length,
      repositoriesUsingEarlierSuccessfulResult: latestScans.filter(scan => {
        const successful = successfulByRepository.get(repositoryKey(scan));
        return successful && String(successful.scan) !== String(scan.scan);
      }).length,
      repositoriesWithoutSuccessfulBaseline: [...knownRepositoryKeys].filter(key => !successfulByRepository.has(key)).length,
    };

    const riskDistribution = emptyRiskDistribution();
    for (const group of historicalRiskGroups) {
      if (Object.hasOwn(riskDistribution, group._id)) riskDistribution[group._id] = group.count;
    }
    const currentRiskDistribution = emptyRiskDistribution();
    for (const group of currentRiskGroups) {
      if (Object.hasOwn(currentRiskDistribution, group._id)) currentRiskDistribution[group._id] = group.count;
    }

    const scannerStatus = {};
    for (const scan of scannerScans) {
      const failed = new Set((scan.scannerErrors || []).map(({ scanner }) => scanner));
      const used = new Set(scan.scannersUsed || []);
      for (const scanner of [...new Set([...used, ...failed])]) {
        if (!Object.hasOwn(scannerStatus, scanner)) {
          scannerStatus[scanner] = {
            status: failed.has(scanner) ? "failed" : "completed",
            scanAt: scan.createdAt,
          };
        }
      }
    }

    return {
      organization: { id: organization._id, name: organization.name },
      repositories: { connected: Boolean(organization.githubInstallationId), total: repositories?.length ?? null },
      totals: {
        scans: scansCount,
        findings: historicalFindingsCount,
        criticalAndHigh: riskDistribution.critical + riskDistribution.high,
        currentFindings: currentFindingsCount,
        currentCriticalAndHigh: currentRiskDistribution.critical + currentRiskDistribution.high,
      },
      riskDistribution,
      currentRiskDistribution,
      currentFindingsStatus,
      recentScans: recentScans.map((scan) => ({
        ...scan,
        durationMs: scan.startedAt && scan.completedAt
          ? Math.max(0, new Date(scan.completedAt) - new Date(scan.startedAt))
          : null,
      })),
      priorityFindings,
      integrationWarning,
      scannerStatus,
    };
  }
}

module.exports = DashboardService;

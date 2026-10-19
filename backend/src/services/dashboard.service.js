const Organization = require("../models/Organization");
const Scan = require("../models/Scan");
const Finding = require("../models/Finding");
const { getRepositories } = require("./github.service");

const RECENT_SCAN_LIMIT = 6;
const PRIORITY_FINDING_LIMIT = 8;
const RECENT_SCANNER_SCAN_LIMIT = 20;

class DashboardService {
  static async getOrganizationOverview(organizationId) {
    const organization = await Organization.findById(organizationId).lean();
    if (!organization) {
      const error = new Error("Organization not found");
      error.statusCode = 404;
      error.code = "ORGANIZATION_NOT_FOUND";
      throw error;
    }

    const [scansCount, findingsCount, riskGroups, recentScans, priorityFindings, scannerScans] =
      await Promise.all([
        Scan.countDocuments({ organization: organizationId }),
        Finding.countDocuments({ organization: organizationId }),
        Finding.aggregate([
          { $match: { organization: organization._id } },
          { $group: { _id: "$riskCategory", count: { $sum: 1 } } },
        ]),
        Scan.find({ organization: organizationId })
          .sort({ createdAt: -1 })
          .limit(RECENT_SCAN_LIMIT)
          .select("owner repo status summary createdAt startedAt completedAt scannersUsed scannerErrors")
          .lean(),
        Finding.aggregate([
          { $match: { organization: organization._id } },
          { $sort: { createdAt: -1, _id: -1 } },
          {
            $group: {
              _id: "$fingerprint",
              finding: { $first: "$$ROOT" },
            },
          },
          { $replaceRoot: { newRoot: "$finding" } },
          { $sort: { riskScore: -1, createdAt: -1 } },
          { $limit: PRIORITY_FINDING_LIMIT },
          {
            $project: {
              owner: 1,
              repo: 1,
              filePath: 1,
              startLine: 1,
              cwe: 1,
              ruleId: 1,
              scanner: 1,
              severity: 1,
              title: 1,
              riskScore: 1,
              riskCategory: 1,
              createdAt: 1,
              scan: 1,
            },
          },
        ]),
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

    const repositories = organization.githubInstallationId
      ? await getRepositories(organization.githubInstallationId)
      : null;

    const riskDistribution = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const group of riskGroups) {
      if (Object.hasOwn(riskDistribution, group._id)) {
        riskDistribution[group._id] = group.count;
      }
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
      organization: {
        id: organization._id,
        name: organization.name,
      },
      repositories: {
        connected: Boolean(organization.githubInstallationId),
        total: repositories?.length ?? null,
      },
      totals: {
        scans: scansCount,
        findings: findingsCount,
        criticalAndHigh: riskDistribution.critical + riskDistribution.high,
      },
      riskDistribution,
      recentScans: recentScans.map((scan) => ({
        ...scan,
        durationMs:
          scan.startedAt && scan.completedAt
            ? Math.max(0, new Date(scan.completedAt) - new Date(scan.startedAt))
            : null,
      })),
      priorityFindings,
      scannerStatus,
    };
  }
}

module.exports = DashboardService;

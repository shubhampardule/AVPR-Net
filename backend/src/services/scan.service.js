const Scan = require("../models/Scan");
const Finding = require("../models/Finding");
const Organization = require("../models/Organization");
const { scanQueue } = require("../queues/scanQueue");
const { bad, integer, repository, optionalCommitSha } = require("../utils/input");
const { SCAN_RECORD_DEADLINE_MS } = require("../config/scan-timing");

class ScanService {
  /**
   * Enqueues a new scan job asynchronously. Returns 202-ready payload immediately.
   */
  static async enqueueScan({ organizationId, owner, repo, installationId, ref, includeDependencies = false }) {
    repository(owner, repo);
    // 1. Verify organization exists and is connected to GitHub
    const org = await Organization.findById(organizationId);
    if (!org || org.status !== "active") {
      const err = new Error("Organization not found");
      err.statusCode = 404;
      err.code = "ORGANIZATION_NOT_FOUND";
      throw err;
    }

    const effectiveInstallationId = installationId || org.githubInstallationId;
    if (!effectiveInstallationId) {
      const err = new Error("GitHub installation not found for this organization");
      err.statusCode = 400;
      err.code = "GITHUB_NOT_CONNECTED";
      throw err;
    }

    // Resolve an authorized immutable commit before creating any scan.
    const { resolveCommit } = require("./github.service");
    ref = optionalCommitSha(ref);
    const commit = await resolveCommit(effectiveInstallationId, owner, repo, ref);
    await Scan.init();
    await require("./budget.service").consume(`scans:${organizationId}`, 20, 60 * 60 * 1000);
    await Scan.updateMany({ organization: organizationId, owner, repo, status: { $in: ["queued", "running"] },
      deadlineAt: { $lt: new Date() } }, { $set: { status: "failed", activeKey: null, leaseUntil: null,
        leaseToken: null, errorMessage: "Scan deadline expired", completedAt: new Date() } });
    // A unique partial index prevents concurrent enqueues for this repository.
    const scan = await Scan.create({
      organization: organizationId,
      installationId: effectiveInstallationId,
      owner,
      repo,
      status: "queued",
      commitSha: commit.sha,
      branch: commit.branch,
      activeKey: `${organizationId}:${owner.toLowerCase()}/${repo.toLowerCase()}`,
      deadlineAt: new Date(Date.now() + SCAN_RECORD_DEADLINE_MS),
      includeDependencies: includeDependencies === true,
    });

    // 3. Enqueue the job through BullMQ locally or Vercel Queues in production.
    let job;
    try {
      job = await scanQueue.add("process-repository-scan", {
        scanId: scan._id.toString(),
        organizationId: organizationId.toString(),
        installationId: effectiveInstallationId,
        owner,
        repo,
      });

      scan.jobId = job.id;
      await scan.save();
    } catch (queueErr) {
      scan.status = "failed";
      scan.errorMessage = `Failed to enqueue scan: ${queueErr.message}`;
      scan.activeKey = null;
      scan.leaseUntil = null;
      scan.leaseToken = null;
      await scan.save();
      const err = new Error(scan.errorMessage);
      err.statusCode = 503;
      err.code = "SCAN_QUEUE_UNAVAILABLE";
      throw err;
    }

    return {
      scanId: scan._id,
      jobId: job.id,
      status: scan.status,
      owner,
      repo,
      createdAt: scan.createdAt,
    };
  }

  /**
   * Retrieves status and summary of a scan
   */
  static async getScanStatus(scanId) {
    const scan = await Scan.findById(scanId);
    if (!scan) {
      const err = new Error("Scan record not found");
      err.statusCode = 404;
      err.code = "SCAN_NOT_FOUND";
      throw err;
    }
    return scan;
  }

  /**
   * Retrieves findings for a completed or active scan with optional filtering
   */
  static async getScanFindings(scanId, query = {}) {
    const { severity, riskCategory, page = 1, limit = 50 } = query;
    const filter = { scan: scanId };

    if (severity) {
      if (!["critical", "high", "medium", "low", "info"].includes(severity)) throw bad("Invalid severity");
      filter.severity = severity;
    }
    if (riskCategory) {
      if (!["critical", "high", "medium", "low"].includes(riskCategory)) throw bad("Invalid risk category");
      filter.riskCategory = riskCategory;
    }

    const currentPage = integer(query.page, 1, 10000);
    const take = integer(query.limit, 50, 100);
    const skip = (currentPage - 1) * take;

    const [findings, total] = await Promise.all([
      Finding.find(filter)
        .sort({ riskScore: -1, _id: -1 })
        .skip(skip)
        .limit(take)
        .lean(),
      Finding.countDocuments(filter),
    ]);

    return {
      findings,
      pagination: {
        page: currentPage,
        limit: take,
        total,
        totalPages: Math.ceil(total / take) || 1,
      },
    };
  }

  /**
   * List past scans for an organization's repository
   */
  static async listScansForRepo(organizationId, owner, repo) {
    return Scan.find({ organization: organizationId, owner, repo })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
  }
}

module.exports = ScanService;

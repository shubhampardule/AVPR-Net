const Scan = require("../models/Scan");
const Finding = require("../models/Finding");
const Organization = require("../models/Organization");
const { scanQueue } = require("../queues/scanQueue");

class ScanService {
  /**
   * Enqueues a new scan job asynchronously. Returns 202-ready payload immediately.
   */
  static async enqueueScan({ organizationId, owner, repo, installationId }) {
    // 1. Verify organization exists and is connected to GitHub
    const org = await Organization.findById(organizationId);
    if (!org) {
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

    // 2. Create Scan record in MongoDB with initial status 'queued'
    const scan = await Scan.create({
      organization: organizationId,
      installationId: effectiveInstallationId,
      owner,
      repo,
      status: "queued",
    });

    // 3. Enqueue BullMQ job
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
      scan.errorMessage = `Failed to enqueue scan in BullMQ: ${queueErr.message}. Ensure Redis server is active.`;
      await scan.save();
      const err = new Error(scan.errorMessage);
      err.statusCode = 503;
      err.code = "REDIS_UNAVAILABLE";
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

    if (severity) filter.severity = severity;
    if (riskCategory) filter.riskCategory = riskCategory;

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const [findings, total] = await Promise.all([
      Finding.find(filter)
        .sort({ riskScore: -1, createdAt: -1 })
        .skip(skip)
        .limit(take)
        .lean(),
      Finding.countDocuments(filter),
    ]);

    return {
      findings,
      pagination: {
        page: parseInt(page, 10),
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

const ScanService = require("../services/scan.service");
const { recordAuditEvent } = require("../services/audit.service");

/**
 * Controller handling scan initiation and telemetry endpoints
 */
const enqueueScan = async (req, res, next) => {
  try {
    const { organizationId, owner, repo } = req.params;

    const result = await ScanService.enqueueScan({
      organizationId,
      owner,
      repo,
      includeDependencies: req.body?.includeDependencies === true,
    });
    await recordAuditEvent(req, {
      action: "scan.started",
      target: `scan/${result.scanId}`,
      details: {
        repository: `${owner}/${repo}`,
        scanId: String(result.scanId),
        branch: result.branch,
        commitSha: result.commitSha,
        includeDependencies: result.includeDependencies,
      },
    });

    // Return 202 Accepted immediately as per async background architecture
    return res.status(202).json({
      success: true,
      data: result,
      message: "Security scan queued successfully",
    });
  } catch (error) {
    next(error);
  }
};

const getScanStatus = async (req, res, next) => {
  try {
    const { scanId } = req.params;
    const scan = await ScanService.getScanStatus(scanId);

    return res.status(200).json({
      success: true,
      data: scan,
      message: "Scan status fetched successfully",
    });
  } catch (error) {
    next(error);
  }
};

const getScanFindings = async (req, res, next) => {
  try {
    const { scanId } = req.params;
    const result = await ScanService.getScanFindings(scanId, req.query);

    return res.status(200).json({
      success: true,
      data: result,
      message: "Scan findings fetched successfully",
    });
  } catch (error) {
    next(error);
  }
};

const listRepoScans = async (req, res, next) => {
  try {
    const { organizationId, owner, repo } = req.params;
    const scans = await ScanService.listScansForRepo(organizationId, owner, repo);

    return res.status(200).json({
      success: true,
      data: {
        total: scans.length,
        scans,
      },
      message: "Repository scan history fetched successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  enqueueScan,
  getScanStatus,
  getScanFindings,
  listRepoScans,
};

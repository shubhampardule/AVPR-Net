const mongoose = require("mongoose");
const { Worker } = require("bullmq");
const dotenv = require("dotenv");

dotenv.config();

const env = require("../config/env");
const { redisConnection } = require("../config/redis");
const { SCAN_QUEUE_NAME } = require("../queues/scanQueue");
const Scan = require("../models/Scan");
const Finding = require("../models/Finding");
const { createEphemeralWorkspace } = require("../services/workspace.service");
const ScannerOrchestrator = require("../scanners/orchestrator");
const NormalizerService = require("../services/normalizer.service");
const DeduplicatorService = require("../services/deduplicator.service");
const OccurrenceService = require("../services/occurrence.service");
const RiskService = require("../services/risk.service");

// Connect to MongoDB if running standalone
const ensureDatabase = async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(env.databaseUrl);
    console.info("[ScanWorker] Connected to MongoDB database.");
  }
};

/**
 * Executes the complete scan pipeline on a single job in the exact prescribed order:
 *
 * 1. Fetch authorized repository zipball via GitHub App Octokit
 * 2. Extract into ephemeral temporary workspace
 * 3. Run security scanners (Semgrep, Bandit)
 * 4. Normalize raw results into common Finding shape
 * 5. Deduplicate and correlate via deterministic SHA-256 fingerprint
 * 6. Calculate occurrence counts on deduplicated set
 * 7. Calculate individual risk factors (Severity, Exploitability, Occurrence, Business Impact)
 * 8. Compute final weighted risk score (0.40*S + 0.25*E + 0.15*O + 0.20*B) and category
 * 9. Persist normalized findings in MongoDB
 * 10. Update Scan summary with status 'completed' and counts
 * 11. Ephemeral workspace cleanup (guaranteed in finally block)
 */
const processScanJob = async (job) => {
  const { scanId, organizationId, installationId, owner, repo } = job.data;
  console.info(`[ScanWorker] Processing job ${job.id} for scan ${scanId} (${owner}/${repo})...`);

  await ensureDatabase();

  const scan = await Scan.findById(scanId);
  if (!scan) {
    throw new Error(`Scan ${scanId} not found in database.`);
  }

  scan.status = "running";
  scan.startedAt = new Date();
  await scan.save();

  let workspaceHandle = null;

  try {
    // Step 1 & 2: Ephemeral workspace from authorized GitHub App installation zipball
    workspaceHandle = await createEphemeralWorkspace(installationId, owner, repo);
    const { workspacePath } = workspaceHandle;

    // Step 3: Run Scanner Orchestration layer
    const orchestrator = new ScannerOrchestrator();
    const { results, scannersRun, scannerErrors } = await orchestrator.runAll(workspacePath);
    scan.scannersUsed = scannersRun;
    scan.scannerErrors = scannerErrors;

    // Step 4: Normalize raw findings from all scanners
    let allNormalized = [];
    for (const res of results) {
      const normalized = NormalizerService.normalize(res.scanner, res.findings, workspacePath);
      console.info(
        `[ScanWorker] ${res.scanner}: raw=${res.findings.length} normalized=${normalized.length}`
      );
      allNormalized = allNormalized.concat(normalized);
    }

    // Step 5: Deduplicate and correlate using deterministic SHA-256 fingerprint
    const deduplicated = DeduplicatorService.deduplicate(owner, repo, allNormalized);
    console.info(
      `[ScanWorker] Findings normalized=${allNormalized.length} deduplicated=${deduplicated.length}`
    );

    // Step 6: Calculate occurrence counts across deduplicated set
    const occurrenceMap = OccurrenceService.computeOccurrences(deduplicated);
    console.info(
      `[ScanWorker] Occurrence processing completed for ${deduplicated.length} findings across ${occurrenceMap.size} CWE groups.`
    );

    // Step 7 & 8: Calculate risk factors and compute weighted score & category
    const findingsToInsert = deduplicated.map((item) => {
      const cweKey = (item.cwe || "CWE-Unknown").toUpperCase();
      const count = occurrenceMap.get(cweKey) || 1;

      const { riskScore, riskCategory, riskFactors } = RiskService.evaluateRisk(item, count);

      return {
        scan: scan._id,
        organization: organizationId,
        owner,
        repo,
        filePath: item.filePath,
        startLine: item.startLine,
        endLine: item.endLine,
        column: item.column,
        cwe: item.cwe,
        ruleId: item.ruleId,
        scanner: item.scanner,
        severity: item.severity,
        title: item.title,
        description: item.description,
        evidenceSnippet: item.evidenceSnippet,
        remediation: item.remediation,
        fingerprint: item.fingerprint,
        riskScore,
        riskFactors,
        riskCategory,
        status: "open",
      };
    });
    console.info(`[ScanWorker] Risk calculation completed for ${findingsToInsert.length} findings.`);

    // Step 9: Persist findings to MongoDB
    if (findingsToInsert.length > 0) {
      await Finding.insertMany(findingsToInsert);
    }
    console.info(`[ScanWorker] Persisted ${findingsToInsert.length} findings to MongoDB.`);

    // Step 10: Update scan summary counts and mark completed
    const summary = {
      total: findingsToInsert.length,
      critical: findingsToInsert.filter((f) => f.riskCategory === "critical").length,
      high: findingsToInsert.filter((f) => f.riskCategory === "high").length,
      medium: findingsToInsert.filter((f) => f.riskCategory === "medium").length,
      low: findingsToInsert.filter((f) => f.riskCategory === "low").length,
    };

    scan.status = "completed";
    scan.completedAt = new Date();
    scan.summary = summary;
    await scan.save();

    console.info(`[ScanWorker] Scan ${scanId} completed successfully. ${summary.total} findings persisted.`);
    return { success: true, summary };
  } catch (error) {
    console.error(`[ScanWorker] Scan ${scanId} failed:`, error.message);
    scan.status = "failed";
    scan.completedAt = new Date();
    scan.errorMessage = error.message;
    await scan.save();
    throw error;
  } finally {
    // Step 11: Cleanup workspace ephemeral directory guaranteed in finally
    if (workspaceHandle && typeof workspaceHandle.cleanup === "function") {
      workspaceHandle.cleanup();
      console.info(`[ScanWorker] Ephemeral workspace cleaned up for scan ${scanId}.`);
    }
  }
};

const worker = new Worker(SCAN_QUEUE_NAME, processScanJob, {
  connection: redisConnection,
  concurrency: 2,
});

worker.on("ready", () => {
  console.info(`[ScanWorker] Ready and listening for jobs on queue '${SCAN_QUEUE_NAME}'...`);
});

worker.on("failed", (job, err) => {
  console.error(`[ScanWorker] Job ${job?.id} failed with error:`, err.message);
});

worker.on("error", (err) => {
  console.error("[ScanWorker] Worker error:", err.message);
});

module.exports = {
  worker,
  processScanJob,
};

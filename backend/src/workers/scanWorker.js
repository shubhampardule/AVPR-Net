const mongoose = require("mongoose");
const { Worker } = require("bullmq");
const dotenv = require("dotenv");

dotenv.config();

const env = require("../config/env");
const { redisConnection } = require("../config/redis");
const { SCAN_QUEUE_NAME, SCAN_QUEUE_REGION } = require("../queues/scanQueue");
const Scan = require("../models/Scan");
const Finding = require("../models/Finding");
const { createEphemeralWorkspace } = require("../services/workspace.service");
const ScannerOrchestrator = require("../scanners/orchestrator");
const NormalizerService = require("../services/normalizer.service");
const DeduplicatorService = require("../services/deduplicator.service");
const OccurrenceService = require("../services/occurrence.service");
const RiskService = require("../services/risk.service");
const heartbeatWorker = () => require("../models/UsageBucket").updateOne({ _id: "worker:bom1" },
  { $set: { count: 1, expires: new Date(Date.now() + 90000) } }, { upsert: true });

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
const processScanJobInternal = async (job, controller) => {
  const { scanId, organizationId, installationId, owner, repo } = job.data;
  console.info(`[ScanWorker] Processing job ${job.id} for scan ${scanId} (${owner}/${repo})...`);

  await ensureDatabase();

  const now = new Date();
  const scan = await Scan.findOneAndUpdate({ _id: scanId, cancelledAt: null,
    $and: [{ $or: [{ deadlineAt: null }, { deadlineAt: { $gt: now } }] },
      { $or: [{ status: "queued" }, { status: "failed" }, { status: "running", leaseUntil: { $lt: now } }] }] },
    { $set: { status: "running", startedAt: now, leaseUntil: new Date(Date.now() + 60000), errorMessage: null } }, { returnDocument: "after" });
  if (!scan) {
    return { success: true, skipped: true };
  }

  if (scan.status === "completed") {
    console.info(`[ScanWorker] Scan ${scanId} was already completed; skipping duplicate delivery.`);
    return { success: true, skipped: true, summary: scan.summary };
  }

  scan.status = "running";
  scan.startedAt = new Date();
  await scan.save();

  let workspaceHandle = null;
  const deadline = setTimeout(() => controller.abort(), 10 * 60 * 1000);
  const heartbeat = setInterval(async () => {
    try {
      await heartbeatWorker();
      const renewed = await Scan.findOneAndUpdate({ _id: scanId, status: "running", cancelledAt: null },
        { $set: { leaseUntil: new Date(Date.now() + 60000) } });
      if (!renewed) controller.abort();
    } catch { controller.abort(); }
  }, 15000);

  try {
    // Step 1 & 2: Ephemeral workspace from authorized GitHub App installation zipball
    if (!scan.commitSha) {
      scan.commitSha = (await require("../services/github.service").resolveCommit(installationId, owner, repo)).sha;
    }
    workspaceHandle = await createEphemeralWorkspace(installationId, owner, repo, scan.commitSha);
    const { workspacePath } = workspaceHandle;

    // Step 3: Run Scanner Orchestration layer
    const orchestrator = new ScannerOrchestrator(null, { includeDependencies: scan.includeDependencies });
    const { results, scannersRun, scannerErrors, coverage } = await orchestrator.runAll(workspacePath);
    controller.signal.throwIfAborted();
    scan.scannersUsed = scannersRun;
    scan.scannerErrors = scannerErrors;
    scan.coverage = coverage;
    scan.rulesHash = require("node:crypto").createHash("sha256").update(require("node:fs").readFileSync(require("node:path").join(__dirname, "../scanners/rules.yml"))).digest("hex");

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
        correlationKey: item.correlationKey,
        provenance: item.provenance,
        riskScore,
        riskFactors,
        riskCategory,
        status: "open",
      };
    });
    console.info(`[ScanWorker] Risk calculation completed for ${findingsToInsert.length} findings.`);
    if (findingsToInsert.length) {
      const reviews = await Finding.aggregate([
        { $match: { organization: scan.organization, correlationKey: { $in: findingsToInsert.map(f => f.correlationKey) }, reviewedAt: { $ne: null } } },
        { $sort: { reviewedAt: -1 } }, { $group: { _id: "$correlationKey", review: { $first: "$$ROOT" } } }, { $limit: 20000 },
      ]);
      const previous = new Map(reviews.map(item => [item._id, item.review]));
      for (const finding of findingsToInsert) {
        const review = previous.get(finding.correlationKey);
        if (review && ["acknowledged", "dismissed"].includes(review.status)) {
          Object.assign(finding, { status: review.status, statusReason: review.statusReason, reviewedBy: review.reviewedBy, reviewedAt: review.reviewedAt });
        }
      }
    }

    // Step 9: Persist findings to MongoDB
    if (findingsToInsert.length > 0) {
      await Finding.init();
      await Finding.bulkWrite(findingsToInsert.map((finding) => ({
        updateOne: {
          filter: { scan: scan._id, fingerprint: finding.fingerprint },
          update: { $setOnInsert: finding },
          upsert: true,
        },
      })), { ordered: false });
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
    scan.activeKey = null;
    scan.leaseUntil = null;
    scan.completedAt = new Date();
    scan.summary = summary;
    const finalized = await Scan.findOneAndUpdate({ _id: scanId, status: "running", cancelledAt: null },
      { $set: { status: scan.status, completedAt: scan.completedAt, summary, coverage: scan.coverage,
        scannersUsed: scan.scannersUsed, scannerErrors: scan.scannerErrors, rulesHash: scan.rulesHash,
        commitSha: scan.commitSha, activeKey: null, leaseUntil: null } });
    if (!finalized) throw new Error("Scan was cancelled before completion");

    console.info(`[ScanWorker] Scan ${scanId} completed successfully. ${summary.total} findings persisted.`);
    return { success: true, summary };
  } catch (error) {
    console.error(`[ScanWorker] Scan ${scanId} failed:`, error.message);
    scan.status = "failed";
    scan.activeKey = null;
    scan.leaseUntil = null;
    scan.scannerErrors = error.scannerErrors || scan.scannerErrors;
    scan.completedAt = new Date();
    scan.errorMessage = error.message;
    await scan.save();
    throw error;
  } finally {
    clearTimeout(deadline);
    clearInterval(heartbeat);
    // Step 11: Cleanup workspace ephemeral directory guaranteed in finally
    if (workspaceHandle && typeof workspaceHandle.cleanup === "function") {
      workspaceHandle.cleanup();
      console.info(`[ScanWorker] Ephemeral workspace cleaned up for scan ${scanId}.`);
    }
  }
};

const processScanJob = (job) => {
  const controller = new AbortController();
  return require("../services/scan-context").run({ signal: controller.signal }, () => processScanJobInternal(job, controller));
};

const createBullMqWorker = () => {
  if (!redisConnection) throw new Error("REDIS_URL is required to run the local BullMQ scan worker");
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
  const schedules = setInterval(() => require("../services/automation.service").runDueSchedules().catch(() => {}), 60000);
  schedules.unref();
  worker.on("closed", () => clearInterval(schedules));
  const pulse = setInterval(() => heartbeatWorker().catch(() => {}), 30000);
  pulse.unref(); worker.on("closed", () => clearInterval(pulse));
  return worker;
};

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const startVercelQueueWorker = async () => {
  const [{ PollingQueueClient }, { getVercelOidcToken }] = await Promise.all([
    import("@vercel/queue"),
    import("@vercel/oidc"),
  ]);
  let shuttingDown = false;
  process.once("SIGTERM", () => {
    shuttingDown = true;
    console.info("[ScanWorker] Shutdown requested; finishing the current job.");
  });

  console.info(`[ScanWorker] Polling Vercel Queue '${SCAN_QUEUE_NAME}' in ${SCAN_QUEUE_REGION}...`);
  let pollDelayMs = 5000;
  let lastScheduleCheck = 0;
  while (!shuttingDown) {
    try {
      await ensureDatabase();
      await heartbeatWorker();
      await Scan.updateMany({ status: { $in: ["queued", "running"] }, deadlineAt: { $lt: new Date() } },
        { $set: { status: "failed", activeKey: null, errorMessage: "Scan deadline expired", completedAt: new Date() } });
      if (Date.now() - lastScheduleCheck > 60000) {
        await require("../services/automation.service").runDueSchedules();
        lastScheduleCheck = Date.now();
      }
      const token = await getVercelOidcToken();
      const queue = new PollingQueueClient({
        region: SCAN_QUEUE_REGION,
        deploymentId: null,
        token,
      });
      const result = await queue.receive(
        SCAN_QUEUE_NAME,
        "scan-worker",
        async (message) => {
          if (!message || typeof message.scanId !== "string") {
            throw new Error("Scan queue message is invalid");
          }
          await processScanJob({ id: message.scanId, data: message });
        },
        { limit: 1, visibilityTimeoutSeconds: 3600 },
      );
      if (!result.ok) {
        if (result.reason !== "empty") {
          console.warn(`[ScanWorker] Queue receive returned ${result.reason}.`);
        }
        await wait(pollDelayMs);
        pollDelayMs = Math.min(pollDelayMs * 2, 30000);
      } else {
        pollDelayMs = 5000;
      }
    } catch (error) {
      console.error(`[ScanWorker] Vercel Queue poll failed: ${error.message}`);
      await wait(pollDelayMs);
      pollDelayMs = Math.min(pollDelayMs * 2, 30000);
    }
  }

  await mongoose.disconnect();
  if (redisConnection) await redisConnection.quit();
};

if (require.main === module) {
  if (process.env.VERCEL_OIDC_TOKEN_FILE ||
    (process.env.VERCEL === "1" && process.env.VERCEL_ENV === "production")) {
    startVercelQueueWorker().catch((error) => {
      console.error(`[ScanWorker] Vercel Queue worker stopped: ${error.message}`);
      process.exitCode = 1;
    });
  } else {
    createBullMqWorker();
  }
}

module.exports = {
  createBullMqWorker,
  processScanJob,
  startVercelQueueWorker,
};

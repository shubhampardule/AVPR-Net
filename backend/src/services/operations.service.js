const mongoose = require("mongoose");
const UsageBucket = require("../models/UsageBucket");
const Scan = require("../models/Scan");

const SIGNALS = ["provider_failure", "webhook_reject", "request_failure"];
const WINDOW_MS = 15 * 60 * 1000;

async function recordSignal(code, now = Date.now()) {
  if (!SIGNALS.includes(code) || mongoose.connection.readyState !== 1) return false;
  const minute = Math.floor(now / 60000);
  try {
    await UsageBucket.updateOne({ _id: `ops:${code}:${minute}` }, {
      $inc: { count: 1 }, $set: { expires: new Date(now + 60 * 60 * 1000) },
    }, { upsert: true, maxTimeMS: 500 });
    return true;
  } catch { return false; } // Telemetry must never replace the original result.
}

function evaluate(metrics, { maxQueueAgeMs = 5 * 60 * 1000, failureThreshold = 5 } = {}) {
  const alerts = [];
  if (!metrics.workerAvailable) alerts.push("WORKER_HEARTBEAT_STALE");
  if (metrics.oldestQueuedAgeMs !== null && metrics.oldestQueuedAgeMs >= maxQueueAgeMs) alerts.push("QUEUE_AGE_HIGH");
  if (metrics.failedScans >= failureThreshold) alerts.push("SCAN_FAILURES_HIGH");
  if (metrics.partialScans >= failureThreshold) alerts.push("SCANNER_ERRORS_HIGH");
  for (const [signal, label] of [["provider_failure", "PROVIDER_FAILURES_HIGH"], ["webhook_reject", "WEBHOOK_REJECTS_HIGH"], ["request_failure", "REQUEST_FAILURES_HIGH"]]) {
    if ((metrics.signals[signal] || 0) >= failureThreshold) alerts.push(label);
  }
  return { status: alerts.length ? "degraded" : "ok", alerts, metrics };
}

async function snapshot({ now = Date.now() } = {}) {
  if (mongoose.connection.readyState !== 1) return { status: "unavailable", alerts: ["DATABASE_UNAVAILABLE"] };
  const since = new Date(now - WINDOW_MS);
  try {
    const ids = [];
    // Include the first partial minute and filter explicitly; TTL cleanup is asynchronous.
    for (let minute = Math.floor((now - WINDOW_MS) / 60000); minute <= Math.floor(now / 60000); minute++) {
      for (const signal of SIGNALS) ids.push(`ops:${signal}:${minute}`);
    }
    const [worker, oldest, failedScans, partialScans, buckets] = await Promise.all([
      UsageBucket.findById("worker:bom1").select("expires").maxTimeMS(2000).lean(),
      Scan.findOne({ status: "queued" }).sort({ createdAt: 1 }).select("createdAt").maxTimeMS(2000).lean(),
      Scan.countDocuments({ status: "failed", cancelledAt: null, completedAt: { $gte: since } }).maxTimeMS(2000),
      Scan.countDocuments({ status: "completed", "scannerErrors.0": { $exists: true }, completedAt: { $gte: since } }).maxTimeMS(2000),
      UsageBucket.find({ _id: { $in: ids } }).select("_id count").maxTimeMS(2000).lean(),
    ]);
    const signals = Object.fromEntries(SIGNALS.map(signal => [signal, 0]));
    for (const bucket of buckets) {
      const code = String(bucket._id).split(":")[1];
      if (Object.hasOwn(signals, code)) signals[code] += Math.max(0, Number(bucket.count) || 0);
    }
    return evaluate({ windowMs: WINDOW_MS, workerAvailable: Boolean(worker?.expires && new Date(worker.expires).getTime() > now),
      oldestQueuedAgeMs: oldest ? Math.max(0, now - new Date(oldest.createdAt).getTime()) : null,
      failedScans, partialScans, signals });
  } catch { return { status: "unavailable", alerts: ["DATABASE_QUERY_FAILED"] }; }
}

module.exports = { recordSignal, evaluate, snapshot };

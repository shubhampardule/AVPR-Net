const OrganizationMember = require("../models/OrganizationMember");
const Notification = require("../models/Notification");
const logger = require("../config/logger");

function eventForScan(scan) {
  if (!scan || scan.cancelledAt) return null;
  if (scan.status === "failed") return { type: "scan.failed", title: "Scan failed",
    body: "A complete result is not available. Open scan history to review the failure and retry." };
  if (scan.status !== "completed") return null;
  const scannersRan = Array.isArray(scan.scannersUsed) && scan.scannersUsed.length > 0;
  const partial = !scannersRan || Boolean(scan.scannerErrors?.length);
  if (partial) return { type: "scan.partial", title: "Scan needs review",
    body: "Some scanner coverage is missing. Review the scan before treating the repository as clean." };
  const summary = scan.summary || {};
  const count = Number.isSafeInteger(summary.total) && summary.total >= 0 ? summary.total : 0;
  const critical = Number.isSafeInteger(summary.critical) && summary.critical >= 0 ? summary.critical : 0;
  const high = Number.isSafeInteger(summary.high) && summary.high >= 0 ? summary.high : 0;
  return { type: "scan.completed", title: "Scan completed",
    body: count ? `${count} findings detected · ${critical} critical · ${high} high.` : "No findings were detected by the completed scanners." };
}

async function notifyScanResult(scan) {
  const event = eventForScan(scan);
  if (!event || !scan.organization || !scan._id || !scan.owner || !scan.repo) return { delivered: 0, skipped: true };
  try {
    const memberships = await OrganizationMember.find({ organization: scan.organization, status: "active",
      "notificationPreferences.scanResults": { $ne: false } }).select("user").lean();
    if (!memberships.length) return { delivered: 0, skipped: true };
    const now = new Date();
    const dedupeKey = `${scan._id}:${event.type}`;
    const repository = `${scan.owner}/${scan.repo}`.slice(0, 140);
    const href = `/github/${encodeURIComponent(scan.owner)}/${encodeURIComponent(scan.repo)}/scan?scanId=${encodeURIComponent(String(scan._id))}`;
    const operations = memberships.filter(item => item.user).map(({ user }) => ({
      updateOne: {
        filter: { recipient: user, dedupeKey },
        update: { $setOnInsert: { organization: scan.organization, recipient: user, type: event.type, dedupeKey,
          title: event.title, body: event.body, href, scan: scan._id, repository,
          createdAt: now, expiresAt: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000) } },
        upsert: true,
      },
    }));
    if (!operations.length) return { delivered: 0, skipped: true };
    const result = await Notification.bulkWrite(operations, { ordered: false });
    return { delivered: (result.upsertedCount || 0) + (result.modifiedCount || 0), skipped: false };
  } catch (error) {
    logger.error(`notification_delivery_failed type=${event.type} scan=${String(scan._id)} error=${error.name || "Error"}`);
    return { delivered: 0, failed: true };
  }
}

module.exports = { eventForScan, notifyScanResult };

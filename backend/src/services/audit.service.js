const AuditEvent = require("../models/AuditEvent");
const logger = require("../config/logger");

const DETAIL_KEYS = Object.freeze({
  "organization.created": ["organizationName", "slug"],
  "organization.exported": ["recordCount"],
  "organization.deletion_requested": ["purgeAfter"],
  "scan.started": ["repository", "scanId", "branch", "commitSha", "includeDependencies"],
  "scan.cancelled": ["repository", "scanId"],
  "finding.reviewed": ["repository", "scanId", "findingId", "status"],
  "github.installation_connected": ["installationId", "account", "accountType"],
  "github.installation_disconnected": ["installationId", "reason"],
  "member.role_changed": ["memberId", "fromRole", "toRole"],
  "member.removed": ["memberId", "previousRole"],
  "member.left": ["memberId", "previousRole"],
  "member.account_deleted": [],
  "member.ownership_transferred": ["previousOwnerId", "newOwnerId"],
  "invitation.created": ["invitationId", "role", "refreshed"],
  "invitation.revoked": ["invitationId"],
  "invitation.accepted": ["role"],
  "ai.settings_changed": ["hostedAiEnabled"],
  "ai.request_consented": ["operation", "provider"],
  "pull_request.draft_created": ["repository", "pullRequestNumber", "pullRequestUrl", "baseSha"],
});

function safeValue(value) {
  if (typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) return value;
  if (typeof value !== "string") return undefined;
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 500);
}

function safeDetails(action, details = {}) {
  const allowedKeys = DETAIL_KEYS[action];
  if (!allowedKeys) throw new Error("Unsupported audit action");
  return Object.fromEntries(allowedKeys
    .filter(key => Object.hasOwn(details, key))
    .map(key => [key, safeValue(details[key])])
    .filter(([, value]) => value !== undefined));
}

async function recordAuditEvent(req, { action, target, details = {}, organizationId = req.params.organizationId }) {
  if (!organizationId || !req.user?._id || typeof target !== "string" || !target.trim()) {
    throw new Error("Audit event requires an organization, actor, and target");
  }
  const actorLabel = `User ${String(req.user._id).slice(-8)}`;
  try {
    const event = await AuditEvent.create({
      organization: organizationId,
      actor: req.user._id,
      actorLabel,
      action,
      target: target.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 300),
      details: safeDetails(action, details),
      requestId: typeof req.requestId === "string" ? req.requestId.slice(0, 100) : null,
    });
    req.res?.setHeader?.("X-SecurePatch-Audit-Recorded", "true");
    return event;
  } catch (error) {
    logger.error(`audit_event_write_failed action=${action} request=${req.requestId || "unknown"} error=${error.name || "Error"}`);
    req.res?.setHeader?.("X-SecurePatch-Audit-Recorded", "false");
    return null;
  }
}

module.exports = { recordAuditEvent, safeDetails };

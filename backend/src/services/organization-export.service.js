const Organization = require("../models/Organization");
const OrganizationMember = require("../models/OrganizationMember");
const OrganizationInvitation = require("../models/OrganizationInvitation");
const RepositoryAutomation = require("../models/RepositoryAutomation");
const Scan = require("../models/Scan");
const Finding = require("../models/Finding");
const AuditEvent = require("../models/AuditEvent");
const RemediationVerification = require("../models/RemediationVerification");

const MAX_EXPORT_RECORDS = 25000;

function tooLarge() {
  return Object.assign(new Error(`This organization has more than ${MAX_EXPORT_RECORDS} exportable records. Narrow or archive the organization before retrying.`), {
    statusCode: 413,
    code: "EXPORT_LIMIT_EXCEEDED",
  });
}

function idOf(value) {
  return value == null ? null : String(value);
}

function withoutInstallationIds(details = {}) {
  if (!details || typeof details !== "object" || Array.isArray(details)) return {};
  return Object.fromEntries(Object.entries(details).filter(([key]) => key !== "installationId"));
}

async function buildOrganizationExport(organizationId) {
  const organization = await Organization.findById(organizationId)
    .select("name slug status createdAt updatedAt")
    .lean();
  if (!organization) return null;

  const filter = { organization: organizationId };
  const [memberCount, invitationCount, automationCount, scanCount, findingCount, auditEventCount, verificationCount] = await Promise.all([
    OrganizationMember.countDocuments(filter),
    OrganizationInvitation.countDocuments(filter),
    RepositoryAutomation.countDocuments(filter),
    Scan.countDocuments(filter),
    Finding.countDocuments(filter),
    AuditEvent.countDocuments(filter),
    RemediationVerification.countDocuments(filter),
  ]);
  const expectedRecords = memberCount + invitationCount + automationCount + scanCount + findingCount + auditEventCount + verificationCount;
  if (expectedRecords > MAX_EXPORT_RECORDS) throw tooLarge();

  const collectionQueries = [
    limit => OrganizationMember.find(filter).select("user role status notificationPreferences createdAt updatedAt")
      .populate("user", "name email githubUsername").limit(limit).lean(),
    limit => OrganizationInvitation.find(filter).select("email role invitedBy status expiresAt acceptedAt revokedAt createdAt updatedAt")
      .limit(limit).lean(),
    limit => RepositoryAutomation.find(filter).select("owner repo push pullRequest frequency nextRunAt lastScanId createdAt updatedAt")
      .limit(limit).lean(),
    limit => Scan.find(filter).select("owner repo branch commitSha includeDependencies status scannersUsed scannerErrors.scanner scannerErrors.exitCode summary startedAt completedAt createdAt updatedAt")
      .limit(limit).lean(),
    limit => Finding.find(filter).select("scan owner repo filePath startLine endLine column cwe ruleId scanner severity title description remediation fingerprint riskScore riskFactors riskCategory status statusReason reviewedBy reviewedAt reviewHistory createdAt updatedAt")
      .limit(limit).lean(),
    limit => AuditEvent.find(filter).select("actor actorLabel action target details requestId createdAt")
      .limit(limit).lean(),
    limit => RemediationVerification.find(filter).select("scan finding requestedBy repository sourceCommitSha targetPath patchSha256 sourceSha256 proposedSha256 action checks pullRequest createdAt")
      .limit(limit).lean(),
  ];
  const collections = [];
  let remainingRecordBudget = MAX_EXPORT_RECORDS;
  for (const loadCollection of collectionQueries) {
    const collection = await loadCollection(remainingRecordBudget + 1);
    if (collection.length > remainingRecordBudget) throw tooLarge();
    collections.push(collection);
    remainingRecordBudget -= collection.length;
  }
  const [members, invitations, automations, scans, findings, auditEvents, verifications] = collections;

  const records = [members, invitations, automations, scans, findings, auditEvents, verifications];
  const actualRecords = records.reduce((sum, collection) => sum + collection.length, 0);
  if (actualRecords > MAX_EXPORT_RECORDS) throw tooLarge();

  const counts = {
    members: members.length,
    invitations: invitations.length,
    repositoryAutomations: automations.length,
    scans: scans.length,
    findings: findings.length,
    auditEvents: auditEvents.length,
    remediationVerifications: verifications.length,
    total: actualRecords,
  };

  return {
    format: "securepatch-organization-export",
    version: 1,
    generatedAt: new Date().toISOString(),
    organization: {
      id: idOf(organization._id),
      name: organization.name,
      slug: organization.slug,
      status: organization.status,
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
    },
    counts,
    data: {
      members: members.map(member => ({
        id: idOf(member._id),
        user: member.user ? {
          id: idOf(member.user._id),
          name: member.user.name,
          email: member.user.email,
          githubUsername: member.user.githubUsername || null,
        } : null,
        role: member.role,
        status: member.status,
        notificationPreferences: member.notificationPreferences || {},
        createdAt: member.createdAt,
        updatedAt: member.updatedAt,
      })),
      invitations: invitations.map(invitation => ({
        id: idOf(invitation._id),
        email: invitation.email,
        role: invitation.role,
        invitedBy: idOf(invitation.invitedBy),
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        acceptedAt: invitation.acceptedAt,
        revokedAt: invitation.revokedAt,
        createdAt: invitation.createdAt,
        updatedAt: invitation.updatedAt,
      })),
      repositoryAutomations: automations.map(automation => ({
        id: idOf(automation._id),
        owner: automation.owner,
        repo: automation.repo,
        push: automation.push,
        pullRequest: automation.pullRequest,
        frequency: automation.frequency,
        nextRunAt: automation.nextRunAt,
        lastScanId: automation.lastScanId,
        createdAt: automation.createdAt,
        updatedAt: automation.updatedAt,
      })),
      scans: scans.map(scan => ({
        id: idOf(scan._id),
        owner: scan.owner,
        repo: scan.repo,
        branch: scan.branch,
        commitSha: scan.commitSha,
        includeDependencies: scan.includeDependencies,
        status: scan.status,
        scannersUsed: scan.scannersUsed || [],
        scannerErrors: (scan.scannerErrors || []).map(error => ({ scanner: error.scanner, exitCode: error.exitCode })),
        summary: scan.summary || {},
        startedAt: scan.startedAt,
        completedAt: scan.completedAt,
        createdAt: scan.createdAt,
        updatedAt: scan.updatedAt,
      })),
      findings: findings.map(finding => ({
        id: idOf(finding._id),
        scanId: idOf(finding.scan),
        owner: finding.owner,
        repo: finding.repo,
        filePath: finding.filePath,
        startLine: finding.startLine,
        endLine: finding.endLine,
        column: finding.column,
        cwe: finding.cwe,
        ruleId: finding.ruleId,
        scanner: finding.scanner,
        severity: finding.severity,
        title: finding.title,
        description: finding.description,
        remediation: finding.remediation,
        fingerprint: finding.fingerprint,
        riskScore: finding.riskScore,
        riskFactors: finding.riskFactors,
        riskCategory: finding.riskCategory,
        status: finding.status,
        statusReason: finding.statusReason,
        reviewedBy: idOf(finding.reviewedBy),
        reviewedAt: finding.reviewedAt,
        reviewHistory: finding.reviewHistory || [],
        createdAt: finding.createdAt,
        updatedAt: finding.updatedAt,
      })),
      auditEvents: auditEvents.map(event => ({
        id: idOf(event._id),
        actorId: idOf(event.actor),
        actorLabel: event.actorLabel,
        action: event.action,
        target: event.target,
        details: withoutInstallationIds(event.details),
        requestId: event.requestId,
        createdAt: event.createdAt,
      })),
      remediationVerifications: verifications.map(record => ({
        id: idOf(record._id),
        scanId: idOf(record.scan),
        findingId: idOf(record.finding),
        requestedBy: idOf(record.requestedBy),
        repository: record.repository,
        sourceCommitSha: record.sourceCommitSha,
        targetPath: record.targetPath,
        patchSha256: record.patchSha256,
        sourceSha256: record.sourceSha256,
        proposedSha256: record.proposedSha256,
        action: record.action,
        checks: record.checks,
        pullRequest: record.pullRequest,
        createdAt: record.createdAt,
      })),
    },
    exclusions: [
      "Repository source files, finding evidence snippets, and raw scanner stderr are excluded.",
      "OAuth credentials, GitHub installation identifiers, session data, and token hashes are excluded.",
      "Personal notification inboxes, temporary AI caches, and request rate-limit buckets are excluded.",
    ],
    limitations: [
      "This export is assembled from live records and is not a transactionally consistent point-in-time snapshot.",
      `Synchronous export is limited to ${MAX_EXPORT_RECORDS} records.`,
    ],
  };
}

module.exports = { buildOrganizationExport, MAX_EXPORT_RECORDS };

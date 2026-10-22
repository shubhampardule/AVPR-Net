const mongoose = require("mongoose");

const User = require("../src/models/User");
const Organization = require("../src/models/Organization");
const OrganizationMember = require("../src/models/OrganizationMember");
const AuditEvent = require("../src/models/AuditEvent");
const RemediationVerification = require("../src/models/RemediationVerification");
const Notification = require("../src/models/Notification");

describe("AVPR-Net Models", () => {
  describe("User Model", () => {
    test("should require name and email", async () => {
      const user = new User({});

      const error = await user.validate().catch((err) => err);

      expect(error.errors.name).toBeDefined();
      expect(error.errors.email).toBeDefined();
    });

    test("should accept a valid user", async () => {
      const user = new User({
        name: "Test User",
        email: "test@example.com",
        googleId: "google-test-123",
      });

      const error = await user.validate().catch((err) => err);

      expect(error).toBeUndefined();
      expect(user.status).toBe("active");
    });
  });

  describe("Organization Model", () => {
    test("should require name and slug", async () => {
      const organization = new Organization({});

      const error = await organization.validate().catch((err) => err);

      expect(error.errors.name).toBeDefined();
      expect(error.errors.slug).toBeDefined();
    });

    test("should accept a valid organization", async () => {
      const organization = new Organization({
        name: "AVPR-Net Technologies",
        slug: "securepatch-technologies",
      });

      const error = await organization.validate().catch((err) => err);

      expect(error).toBeUndefined();
      expect(organization.status).toBe("active");
      expect(organization.hostedAiEnabled).toBe(false);
    });
  });

  describe("Organization Member Model", () => {
    test("should require user, organization and role", async () => {
      const member = new OrganizationMember({});

      const error = await member.validate().catch((err) => err);

      expect(error.errors.user).toBeDefined();
      expect(error.errors.organization).toBeDefined();
      expect(error.errors.role).toBeDefined();
    });

    test("should accept valid roles", async () => {
      const member = new OrganizationMember({
        user: new mongoose.Types.ObjectId(),
        organization: new mongoose.Types.ObjectId(),
        role: "developer",
      });

      const error = await member.validate().catch((err) => err);

      expect(error).toBeUndefined();
      expect(member.status).toBe("active");
      expect(member.notificationPreferences.scanResults).toBe(true);
    });
  });

  describe("Scan Model", () => {
    test("should require organization, installationId, owner and repo", async () => {
      const Scan = require("../src/models/Scan");
      const scan = new Scan({});
      const error = await scan.validate().catch((err) => err);

      expect(error.errors.organization).toBeDefined();
      expect(error.errors.installationId).toBeDefined();
      expect(error.errors.owner).toBeDefined();
      expect(error.errors.repo).toBeDefined();
    });
  });

  describe("Finding Model", () => {
    test("should validate finding structure and risk score range", async () => {
      const Finding = require("../src/models/Finding");
      const finding = new Finding({
        scan: new mongoose.Types.ObjectId(),
        organization: new mongoose.Types.ObjectId(),
        owner: "testorg",
        repo: "testrepo",
        filePath: "src/app.js",
        startLine: 10,
        ruleId: "rule-1",
        scanner: "semgrep",
        severity: "high",
        title: "Test vulnerability",
        fingerprint: "abc123sha256",
        riskScore: 7.5,
        riskFactors: {
          severity: 7.5,
          exploitability: 9.0,
          occurrence: 2.0,
          businessImpact: 7.0,
        },
        riskCategory: "high",
      });

      const error = await finding.validate().catch((err) => err);
      expect(error).toBeUndefined();
      expect(finding.riskScore).toBe(7.5);
    });

    test("records review decisions with a reviewer and timestamp", async () => {
      const Finding = require("../src/models/Finding");
      const reviewer = new mongoose.Types.ObjectId();
      const finding = new Finding({
        scan: new mongoose.Types.ObjectId(), organization: new mongoose.Types.ObjectId(),
        owner: "testorg", repo: "testrepo", filePath: "src/app.js", startLine: 10,
        ruleId: "rule-1", scanner: "semgrep", severity: "high", title: "Test vulnerability",
        fingerprint: "review-history-test", riskScore: 7.5,
        riskFactors: { severity: 7.5, exploitability: 9, occurrence: 2, businessImpact: 7 },
        riskCategory: "high",
        reviewHistory: [{ status: "dismissed", reason: "Reviewed and not reachable", reviewedBy: reviewer, reviewedAt: new Date() }],
      });
      await expect(finding.validate()).resolves.toBeUndefined();
      expect(finding.reviewHistory).toHaveLength(1);
      expect(finding.reviewHistory[0].reviewedBy.toString()).toBe(reviewer.toString());
    });
  });

  describe("Audit Event Model", () => {
    test("requires a supported action and identifies an actor and organization", async () => {
      const event = new AuditEvent({
        organization: new mongoose.Types.ObjectId(),
        actor: new mongoose.Types.ObjectId(),
        actorLabel: "Reviewer",
        action: "finding.reviewed",
        target: "finding/1",
      });
      await expect(event.validate()).resolves.toBeUndefined();
      expect(AuditEvent.schema.path("createdAt").options.immutable).toBe(true);

      const transferEvent = new AuditEvent({
        organization: new mongoose.Types.ObjectId(), actor: new mongoose.Types.ObjectId(), actorLabel: "Former owner",
        action: "member.ownership_transferred", target: "member/new-owner",
        details: { previousOwnerId: "former-owner", newOwnerId: "new-owner" },
      });
      await expect(transferEvent.validate()).resolves.toBeUndefined();

      const exportEvent = new AuditEvent({
        organization: new mongoose.Types.ObjectId(), actor: new mongoose.Types.ObjectId(), actorLabel: "Owner",
        action: "organization.exported", target: "organization/org-1", details: { recordCount: 42 },
      });
      await expect(exportEvent.validate()).resolves.toBeUndefined();

      const leaveEvent = new AuditEvent({
        organization: new mongoose.Types.ObjectId(), actor: new mongoose.Types.ObjectId(), actorLabel: "Former member",
        action: "member.left", target: "member/former-member", details: { memberId: "former-member", previousRole: "developer" },
      });
      await expect(leaveEvent.validate()).resolves.toBeUndefined();

      const invalid = new AuditEvent({ action: "unknown.action" });
      const error = await invalid.validate().catch(value => value);
      expect(error.errors.action).toBeDefined();
      expect(error.errors.organization).toBeDefined();
      expect(error.errors.actor).toBeDefined();
    });

    test("rejects application-level updates and deletes", async () => {
      await expect(AuditEvent.updateOne({}, { $set: { action: "scan.started" } }).exec()).rejects.toThrow("Audit events are append-only");
      await expect(AuditEvent.deleteMany({}).exec()).rejects.toThrow("Audit events are append-only");
    });
  });

  describe("Remediation Verification Model", () => {
    const validRecord = () => new RemediationVerification({
      organization: new mongoose.Types.ObjectId(), scan: new mongoose.Types.ObjectId(), finding: new mongoose.Types.ObjectId(),
      requestedBy: new mongoose.Types.ObjectId(), repository: "team/project", sourceCommitSha: "a".repeat(40),
      targetPath: "src/index.js", patchSha256: "b".repeat(64), sourceSha256: "c".repeat(64), proposedSha256: "d".repeat(64),
      action: "validation", checks: [
        { name: "patch_integrity", status: "passed", method: "strict-single-file-diff", detailCode: "exact_source_context" },
        { name: "syntax", status: "unavailable", detailCode: "parser_unavailable" },
        { name: "allowed_tests", status: "unavailable", detailCode: "isolated_runner_unavailable" },
        { name: "security_rescan", status: "unavailable", detailCode: "proposal_branch_scan_unavailable" },
      ],
    });

    test("requires exactly one result for each verification check", async () => {
      await expect(validRecord().validate()).resolves.toBeUndefined();
      const invalid = validRecord();
      invalid.checks = invalid.checks.slice(0, 3);
      const error = await invalid.validate().catch(value => value);
      expect(error.errors.checks).toBeDefined();
    });

    test("rejects mutation and deletion after a verification record has been saved", async () => {
      await expect(RemediationVerification.updateOne({}, { $set: { action: "draft_pr" } }).exec())
        .rejects.toThrow("Remediation verification records are append-only");
      await expect(RemediationVerification.deleteMany({}).exec())
        .rejects.toThrow("Remediation verification records are append-only");
    });
  });

  describe("Notification Model", () => {
    test("accepts scan outcome events and expires them through a TTL index", async () => {
      const notice = new Notification({ organization: new mongoose.Types.ObjectId(), recipient: new mongoose.Types.ObjectId(),
        type: "scan.partial", dedupeKey: "scan-1:scan.partial", title: "Scan needs review", body: "Review scan coverage.",
        href: "/github/team/repo/scan?scanId=scan-1", scan: new mongoose.Types.ObjectId(), repository: "team/repo",
        expiresAt: new Date(Date.now() + 86400000) });
      await expect(notice.validate()).resolves.toBeUndefined();
      expect(Notification.schema.indexes()).toContainEqual([expect.objectContaining({ expiresAt: 1 }), expect.objectContaining({ expireAfterSeconds: 0 })]);
      expect(Notification.schema.indexes()).toContainEqual([expect.objectContaining({ recipient: 1, dedupeKey: 1 }), expect.objectContaining({ unique: true })]);
    });

    test("rejects event types outside the documented scan notification policy", async () => {
      const notice = new Notification({ organization: new mongoose.Types.ObjectId(), recipient: new mongoose.Types.ObjectId(),
        type: "invitation.created", dedupeKey: "invite-1", title: "Invite", body: "Invite.", href: "/settings",
        scan: new mongoose.Types.ObjectId(), repository: "team/repo", expiresAt: new Date() });
      const error = await notice.validate().catch(value => value);
      expect(error.errors.type).toBeDefined();
    });
  });
});

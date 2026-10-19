const mongoose = require("mongoose");

const User = require("../src/models/User");
const Organization = require("../src/models/Organization");
const OrganizationMember = require("../src/models/OrganizationMember");

describe("SecurePatch Models", () => {
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
        name: "SecurePatch Technologies",
        slug: "securepatch-technologies",
      });

      const error = await organization.validate().catch((err) => err);

      expect(error).toBeUndefined();
      expect(organization.status).toBe("active");
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
  });
});
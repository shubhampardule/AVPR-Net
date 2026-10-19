const OccurrenceService = require("./occurrence.service");

/**
 * RiskService:
 * Implements the deterministic and explainable risk calculation:
 * Risk = 0.40 × Severity + 0.25 × Exploitability + 0.15 × Occurrence + 0.20 × Business Impact
 *
 * All factors map to a defined 0-10 scale.
 * Output Score maps to categories:
 * - Critical: 8.5 - 10.0
 * - High: 6.5 - 8.49
 * - Medium: 4.0 - 6.49
 * - Low: 0.0 - 3.99
 */
class RiskService {
  /**
   * Severity factor (0 - 10)
   */
  static getSeverityScore(severity) {
    switch ((severity || "").toLowerCase()) {
      case "critical":
        return 9.5;
      case "high":
        return 7.5;
      case "medium":
        return 5.0;
      case "low":
        return 2.5;
      case "info":
      default:
        return 1.0;
    }
  }

  /**
   * Exploitability factor (0 - 10) derived deterministically from CWE category
   */
  static getExploitabilityScore(cwe) {
    const norm = (cwe || "").toUpperCase();

    // RCE, SQLi, Command Injection, SSRF, Deserialization
    if (
      norm.includes("CWE-78") || // OS Command Injection
      norm.includes("CWE-89") || // SQL Injection
      norm.includes("CWE-94") || // Code Injection
      norm.includes("CWE-502") || // Deserialization
      norm.includes("CWE-918") // SSRF
    ) {
      return 9.0;
    }

    // Auth bypass, hardcoded secrets, IDOR, Path traversal, XSS
    if (
      norm.includes("CWE-79") || // XSS
      norm.includes("CWE-22") || // Path Traversal
      norm.includes("CWE-798") || // Hardcoded Credentials
      norm.includes("CWE-287") || // Improper Authentication
      norm.includes("CWE-306") // Missing Authentication
    ) {
      return 7.5;
    }

    // Cryptographic weakness, Weak PRNG, Information disclosure
    if (
      norm.includes("CWE-327") || // Broken Crypto
      norm.includes("CWE-330") || // Insufficient Randomness
      norm.includes("CWE-200") || // Exposure of Sensitive Information
      norm.includes("CWE-312") // Cleartext Storage
    ) {
      return 5.5;
    }

    // Denial of Service, Resource exhaustion, Unhandled exceptions
    if (
      norm.includes("CWE-400") ||
      norm.includes("CWE-770") ||
      norm.includes("CWE-754")
    ) {
      return 4.0;
    }

    // Default unknown / baseline exploitability
    return 4.5;
  }

  /**
   * Business Impact factor (0 - 10) derived deterministically from file path context
   */
  static getBusinessImpactScore(filePath) {
    const p = (filePath || "").toLowerCase();

    // Authentication, billing, secrets, tokens, credentials
    if (
      p.includes("auth") ||
      p.includes("token") ||
      p.includes("secret") ||
      p.includes("credential") ||
      p.includes("payment") ||
      p.includes("billing") ||
      p.includes("crypto") ||
      p.includes(".env")
    ) {
      return 9.0;
    }

    // Core business logic, APIs, routes, controllers, models
    if (
      p.includes("controller") ||
      p.includes("route") ||
      p.includes("api") ||
      p.includes("model") ||
      p.includes("service") ||
      p.includes("server")
    ) {
      return 7.0;
    }

    // Configuration, database configs, scripts
    if (
      p.includes("config") ||
      p.includes("database") ||
      p.includes("script") ||
      p.includes("docker")
    ) {
      return 6.0;
    }

    // UI components, views, styles, client assets
    if (
      p.includes("component") ||
      p.includes("view") ||
      p.includes("page") ||
      p.includes("css") ||
      p.includes("html")
    ) {
      return 4.0;
    }

    // Test files, documentation, mocks
    if (
      p.includes("test") ||
      p.includes("spec") ||
      p.includes("mock") ||
      p.includes("fixture") ||
      p.includes("doc") ||
      p.endsWith(".md")
    ) {
      return 2.0;
    }

    return 5.0;
  }

  /**
   * Evaluates category based on standard thresholds
   * Critical: 8.5 - 10.0
   * High: 6.5 - 8.49
   * Medium: 4.0 - 6.49
   * Low: 0.0 - 3.99
   */
  static getRiskCategory(score) {
    if (score >= 8.5) return "critical";
    if (score >= 6.5) return "high";
    if (score >= 4.0) return "medium";
    return "low";
  }

  /**
   * Evaluates the complete risk factor profile and computes the final weighted score
   * @param {Object} finding
   * @param {number} occurrenceCount
   */
  static evaluateRisk(finding, occurrenceCount = 1) {
    const severityFactor = this.getSeverityScore(finding.severity);
    const exploitabilityFactor = this.getExploitabilityScore(finding.cwe);
    const occurrenceFactor = OccurrenceService.getOccurrenceFactor(occurrenceCount);
    const businessImpactFactor = this.getBusinessImpactScore(finding.filePath);

    // Exact formula: Risk = 0.40 × Severity + 0.25 × Exploitability + 0.15 × Occurrence + 0.20 × Business Impact
    const rawScore =
      0.4 * severityFactor +
      0.25 * exploitabilityFactor +
      0.15 * occurrenceFactor +
      0.2 * businessImpactFactor;

    // Round to 2 decimal places
    const riskScore = Math.min(10.0, Math.max(0.0, Math.round(rawScore * 100) / 100));
    const riskCategory = this.getRiskCategory(riskScore);

    return {
      riskScore,
      riskCategory,
      riskFactors: {
        severity: severityFactor,
        exploitability: exploitabilityFactor,
        occurrence: occurrenceFactor,
        businessImpact: businessImpactFactor,
      },
    };
  }
}

module.exports = RiskService;

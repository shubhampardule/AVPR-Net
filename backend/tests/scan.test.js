const DeduplicatorService = require("../src/services/deduplicator.service");
const OccurrenceService = require("../src/services/occurrence.service");
const RiskService = require("../src/services/risk.service");
const NormalizerService = require("../src/services/normalizer.service");
const ScannerOrchestrator = require("../src/scanners/orchestrator");

describe("Scan Pipeline Core Logic Unit Tests", () => {
  describe("ScannerOrchestrator", () => {
    it("records scanners skipped because their executable is unavailable", async () => {
      const orchestrator = new ScannerOrchestrator([
        {
          name: "semgrep",
          isAvailable: async () => false,
        },
        {
          name: "bandit",
          isAvailable: async () => true,
          scan: async () => [],
        },
      ]);

      const result = await orchestrator.runAll("/workspace");

      expect(result.scannersRun).toEqual(["bandit"]);
      expect(result.scannerErrors).toEqual([
        {
          scanner: "semgrep",
          message: "Scanner executable was not available on PATH.",
        },
      ]);
    });

    it("records scanner errors while continuing with other available scanners", async () => {
      const orchestrator = new ScannerOrchestrator([
        {
          name: "semgrep",
          isAvailable: async () => true,
          scan: async () => { throw new Error("Semgrep execution failed"); },
        },
        {
          name: "bandit",
          isAvailable: async () => true,
          scan: async () => [{ test_id: "B605" }],
        },
      ]);

      const result = await orchestrator.runAll("/workspace");

      expect(result.scannersRun).toEqual(["bandit"]);
      expect(result.results).toEqual([{ scanner: "bandit", findings: [{ test_id: "B605" }] }]);
      expect(result.scannerErrors).toEqual([
        {
          scanner: "semgrep",
          message: "Semgrep execution failed",
          exitCode: null,
          stderr: "",
        },
      ]);
    });
  });

  describe("NormalizerService", () => {
    it("normalizes Semgrep raw output correctly", () => {
      const mockSemgrep = [
        {
          check_id: "javascript.express.security.audit.xss.direct-response-write",
          path: "/tmp/workspace/src/routes/auth.js",
          start: { line: 42, col: 5 },
          end: { line: 43, col: 20 },
          extra: {
            message: "Direct response write may cause XSS",
            severity: "ERROR",
            lines: "res.write(req.query.user);",
            metadata: {
              cwe: ["CWE-79: Cross-site Scripting"],
              impact: "HIGH",
            },
          },
        },
      ];

      const normalized = NormalizerService.normalize("semgrep", mockSemgrep, "/tmp/workspace");
      expect(normalized).toHaveLength(1);
      expect(normalized[0].scanner).toBe("semgrep");
      expect(normalized[0].filePath).toBe("src/routes/auth.js");
      expect(normalized[0].startLine).toBe(42);
      expect(normalized[0].cwe).toBe("CWE-79: Cross-site Scripting");
      expect(normalized[0].severity).toBe("critical");
    });

    it("suppresses Bandit assert warnings in Python test files only", () => {
      const findings = [
        { test_id: "B101", filename: "/tmp/workspace/tests/test_auth.py", line_number: 3 },
        { test_id: "B101", filename: "/tmp/workspace/src/parser_test.py", line_number: 8 },
        { test_id: "B101", filename: "/tmp/workspace/src/auth.py", line_number: 12 },
        { test_id: "B105", filename: "/tmp/workspace/tests/test_auth.py", line_number: 15 },
      ];

      const normalized = NormalizerService.normalize("bandit", findings, "/tmp/workspace");

      expect(normalized.map(({ ruleId, filePath }) => ({ ruleId, filePath }))).toEqual([
        { ruleId: "B101", filePath: expect.stringContaining("auth.py") },
        { ruleId: "B105", filePath: expect.stringContaining("test_auth.py") },
      ]);
      expect(normalized[0].filePath.replace(/\\/g, "/")).toMatch(/src\/auth\.py$/);
      expect(normalized[1].filePath.replace(/\\/g, "/")).toMatch(/tests\/test_auth\.py$/);
    });

    it("recognizes common Python test naming and directory conventions", () => {
      expect(NormalizerService.isPythonTestFile("tests/test_auth.py")).toBe(true);
      expect(NormalizerService.isPythonTestFile("src/parser_test.py")).toBe(true);
      expect(NormalizerService.isPythonTestFile("C:\\repo\\specs\\auth.py")).toBe(true);
      expect(NormalizerService.isPythonTestFile("src/auth.py")).toBe(false);
      expect(NormalizerService.isPythonTestFile("src/latest.py")).toBe(false);
    });
  });

  describe("DeduplicatorService", () => {
    it("eliminates duplicates and generates deterministic SHA-256 fingerprints", () => {
      const findings = [
        {
          scanner: "semgrep",
          filePath: "src/routes/auth.js",
          startLine: 42,
          cwe: "CWE-79",
          ruleId: "xss-rule-1",
          severity: "high",
          title: "XSS Vulnerability",
        },
        {
          scanner: "bandit",
          filePath: "src/routes/auth.js",
          startLine: 42,
          cwe: "CWE-79",
          ruleId: "xss-rule-1",
          severity: "critical", // higher severity should win
          title: "XSS Vulnerability Richer Info",
        },
      ];

      const deduped = DeduplicatorService.deduplicate("testorg", "testrepo", findings);
      expect(deduped).toHaveLength(1);
      expect(deduped[0].fingerprint).toBeDefined();
      expect(deduped[0].fingerprint.length).toBe(64);
      expect(deduped[0].severity).toBe("critical");
    });
  });

  describe("OccurrenceService", () => {
    it("counts occurrences accurately per CWE", () => {
      const deduped = [
        { cwe: "CWE-89" },
        { cwe: "CWE-89" },
        { cwe: "CWE-79" },
      ];

      const counts = OccurrenceService.computeOccurrences(deduped);
      expect(counts.get("CWE-89")).toBe(2);
      expect(counts.get("CWE-79")).toBe(1);
      expect(OccurrenceService.getOccurrenceFactor(2)).toBe(4.5);
      expect(OccurrenceService.getOccurrenceFactor(1)).toBe(2.0);
    });
  });

  describe("RiskService", () => {
    it("evaluates risk score according to exact formula (0.40*S + 0.25*E + 0.15*O + 0.20*B)", () => {
      // Critical severity (9.5)
      // SQL Injection CWE-89 (9.0)
      // Occurrences: 1 (2.0)
      // File path: src/controllers/auth.controller.js (9.0)
      // Expected raw = 0.40 * 9.5 (3.8) + 0.25 * 9.0 (2.25) + 0.15 * 2.0 (0.30) + 0.20 * 9.0 (1.80) = 8.15
      const finding = {
        severity: "critical",
        cwe: "CWE-89",
        filePath: "src/controllers/auth.controller.js",
      };

      const result = RiskService.evaluateRisk(finding, 1);
      expect(result.riskScore).toBe(8.15);
      expect(result.riskCategory).toBe("high");
      expect(result.riskFactors.severity).toBe(9.5);
      expect(result.riskFactors.exploitability).toBe(9.0);
      expect(result.riskFactors.occurrence).toBe(2.0);
      expect(result.riskFactors.businessImpact).toBe(9.0);
    });

    it("maps scores to correct categories", () => {
      expect(RiskService.getRiskCategory(8.6)).toBe("critical");
      expect(RiskService.getRiskCategory(7.0)).toBe("high");
      expect(RiskService.getRiskCategory(5.5)).toBe("medium");
      expect(RiskService.getRiskCategory(3.2)).toBe("low");
    });
  });
});

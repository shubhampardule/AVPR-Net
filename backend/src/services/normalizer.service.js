const path = require("path");

/**
 * Normalizes raw scanner outputs into the standard SecurePatch finding schema
 */
class NormalizerService {
  /**
   * Normalizes findings from a specific scanner
   * @param {string} scanner - "semgrep" | "bandit"
   * @param {Array<any>} rawResults
   * @param {string} workspacePath - base path to relativize file paths
   * @returns {Array<Object>}
   */
  static normalize(scanner, rawResults, workspacePath) {
    if (!Array.isArray(rawResults)) return [];

    if (scanner === "semgrep") {
      return this.normalizeSemgrep(rawResults, workspacePath);
    } else if (scanner === "bandit") {
      return this.normalizeBandit(rawResults, workspacePath);
    }
    if (["secrets", "dependency"].includes(scanner)) return rawResults;
    return [];
  }

  static cleanFilePath(fullPath, workspacePath) {
    if (!path.isAbsolute(fullPath) && !path.win32.isAbsolute(fullPath)) {
      return String(fullPath).replace(/\\/g, "/").replace(/^\.\//, "");
    }
    let rel = path.relative(workspacePath, fullPath).replace(/\\/g, "/");
    if (rel.startsWith("./")) rel = rel.substring(2);
    return rel;
  }

  static isPythonTestFile(filePath) {
    const normalizedPath = String(filePath || "").replace(/\\/g, "/").toLowerCase();
    const segments = normalizedPath.split("/").filter(Boolean);
    const fileName = segments.at(-1) || "";
    const testDirectory = segments.slice(0, -1).some((segment) =>
      ["test", "tests", "__tests__", "spec", "specs"].includes(segment)
    );
    const testFileName = /^(?:test|spec)\.py$/.test(fileName)
      || /^(?:test|spec)_.*\.py$/.test(fileName)
      || /.*_(?:test|spec)\.py$/.test(fileName)
      || fileName === "conftest.py";

    return fileName.endsWith(".py") && (testDirectory || testFileName);
  }

  static normalizeSemgrep(results, workspacePath) {
    return results.map((item) => {
      const filePath = this.cleanFilePath(item.path, workspacePath);
      const startLine = item.start?.line || 1;
      const endLine = item.end?.line || startLine;
      const column = item.start?.col || 1;

      // Extract CWE if available
      let cwe = "CWE-Unknown";
      if (item.extra?.metadata?.cwe) {
        const rawCwe = item.extra.metadata.cwe;
        if (Array.isArray(rawCwe) && rawCwe.length > 0) {
          cwe = String(rawCwe[0]);
        } else if (typeof rawCwe === "string") {
          cwe = rawCwe;
        }
      }

      // Map severity
      const rawSev = (item.extra?.severity || "").toLowerCase();
      let severity = "medium";
      if (rawSev === "error") severity = "high";
      else if (rawSev === "warning") severity = "medium";
      else if (rawSev === "info") severity = "low";

      // If confidence or metadata indicates critical
      if (item.extra?.metadata?.impact === "HIGH" && severity === "high") {
        severity = "critical";
      }

      const ruleId = item.check_id || "semgrep-finding";
      const title = item.extra?.message?.split("\n")[0] || ruleId;
      const description = item.extra?.message || "";
      const evidenceSnippet = (item.extra?.lines || "").slice(0, 1000);
      const remediation = item.extra?.metadata?.fix || "";

      return {
        scanner: "semgrep",
        filePath,
        startLine,
        endLine,
        column,
        cwe,
        ruleId,
        severity,
        title,
        description,
        evidenceSnippet,
        remediation,
      };
    });
  }

  static normalizeBandit(results, workspacePath) {
    return results.filter((item) =>
      !(item.test_id === "B101" && this.isPythonTestFile(item.filename))
    ).map((item) => {
      const filePath = this.cleanFilePath(item.filename, workspacePath);
      const startLine = item.line_number || 1;
      const endLine = item.line_range ? item.line_range[item.line_range.length - 1] : startLine;
      const column = item.col_offset || null;

      let cwe = "CWE-Unknown";
      if (item.issue_cwe?.id) {
        cwe = `CWE-${item.issue_cwe.id}`;
      }

      const rawSev = (item.issue_severity || "").toLowerCase();
      let severity = "medium";
      if (rawSev === "high") severity = "high";
      else if (rawSev === "medium") severity = "medium";
      else if (rawSev === "low") severity = "low";

      if (rawSev === "high" && (item.issue_confidence || "").toLowerCase() === "high") {
        severity = "critical";
      }

      const ruleId = item.test_id || item.test_name || "bandit-finding";
      const title = item.issue_text || ruleId;
      const description = `${item.issue_text || ""} (Test ID: ${ruleId})`;
      const evidenceSnippet = (item.code || "").slice(0, 1000);
      const remediation = item.more_info || "";

      return {
        scanner: "bandit",
        filePath,
        startLine,
        endLine,
        column,
        cwe,
        ruleId,
        severity,
        title,
        description,
        evidenceSnippet,
        remediation,
      };
    });
  }
}

module.exports = NormalizerService;

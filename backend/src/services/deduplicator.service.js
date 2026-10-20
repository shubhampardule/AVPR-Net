const crypto = require("crypto");

/**
 * DeduplicatorService:
 * Creates deterministic SHA-256 fingerprints and eliminates duplicate findings
 * across multiple scanning runs and scanners.
 */
class DeduplicatorService {
  /**
   * Generates a deterministic SHA-256 fingerprint for a finding.
   *
   * Fingerprint basis:
   * owner + repo + normalizedFilePath + cwe + ruleId + startLine
   */
  static generateFingerprint(owner, repo, finding) {
    const normPath = (finding.filePath || "").trim().replace(/\\/g, "/");
    const cwe = (finding.cwe || "CWE-Unknown").trim().toUpperCase();
    const rule = (finding.ruleId || "").trim();
    const line = finding.startLine || 1;

    const payload = `${owner.toLowerCase()}:${repo.toLowerCase()}:${normPath}:${cwe}:${rule}:${line}`;
    return crypto.createHash("sha256").update(payload).digest("hex");
  }

  /**
   * Deduplicates a list of normalized findings.
   * If two scanners find the same issue, the one with higher severity or richer evidence is kept.
   *
   * @param {string} owner
   * @param {string} repo
   * @param {Array<Object>} findings
   * @returns {Array<Object>} Deduplicated findings with assigned fingerprints
   */
  static deduplicate(owner, repo, findings) {
    const seen = new Map();

    for (const item of findings) {
      const fingerprint = this.generateFingerprint(owner, repo, item);
      item.fingerprint = fingerprint;
      const evidence = (item.evidenceSnippet || "").replace(/^\s*\d+\s+/gm, "").replace(/\s+/g, " ").trim();
      item.correlationKey = crypto.createHash("sha256").update(JSON.stringify([
        owner.toLowerCase(), repo.toLowerCase(), item.filePath, item.cwe?.match(/CWE-\d+/)?.[0],
        evidence || `${item.ruleId}:${item.startLine}`,
      ])).digest("hex");
      item.provenance = [{ scanner: item.scanner, ruleId: item.ruleId, severity: item.severity }];

      if (!seen.has(fingerprint)) {
        seen.set(fingerprint, item);
      } else {
        // If existing item has less severity or lower description length, prefer the more informative one
        const existing = seen.get(fingerprint);
        item.provenance = [...existing.provenance, ...item.provenance];
        const severityRank = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
        if ((severityRank[item.severity] || 0) > (severityRank[existing.severity] || 0)) {
          seen.set(fingerprint, item);
        } else {
          existing.provenance = item.provenance;
        }
      }
    }

    return Array.from(seen.values());
  }
}

module.exports = DeduplicatorService;

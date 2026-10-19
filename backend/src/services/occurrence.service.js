/**
 * OccurrenceService:
 * Calculates occurrence statistics per CWE/rule across deduplicated findings
 * to supply the occurrence factor in the risk model.
 */
class OccurrenceService {
  /**
   * Computes occurrence counts across a set of deduplicated findings
   * @param {Array<Object>} deduplicatedFindings
   * @returns {Map<string, number>} Map of CWE -> count
   */
  static computeOccurrences(deduplicatedFindings) {
    const counts = new Map();

    for (const finding of deduplicatedFindings) {
      const key = (finding.cwe || "CWE-Unknown").toUpperCase();
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    return counts;
  }

  /**
   * Translates raw count into defined 0-10 scale:
   * >= 10 instances -> 8.5
   * 5 - 9 instances -> 6.5
   * 2 - 4 instances -> 4.5
   * 1 instance     -> 2.0
   * 0              -> 0.0
   *
   * @param {number} count
   * @returns {number} Score on 0-10 scale
   */
  static getOccurrenceFactor(count) {
    if (count >= 10) return 8.5;
    if (count >= 5) return 6.5;
    if (count >= 2) return 4.5;
    if (count === 1) return 2.0;
    return 0.0;
  }
}

module.exports = OccurrenceService;

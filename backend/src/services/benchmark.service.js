// Offline evaluation of supplied annotations and scanner exports. Never runs project code.
const text = value => typeof value === "string" && value.length > 0 && value.length <= 500;
const pairCount = count => count * (count - 1) / 2;
const sumPairs = map => [...map.values()].reduce((sum, count) => sum + pairCount(count), 0);
const increment = (map, key) => map.set(key, (map.get(key) || 0) + 1);
const ratio = (numerator, denominator) => denominator ? numerator / denominator : null;

function evaluateBenchmark(input) {
  if (!input || input.schemaVersion !== 1 || !["synthetic", "reviewed"].includes(input.datasetKind) ||
      !Array.isArray(input.cases) || input.cases.length < 1 || input.cases.length > 1000) throw new Error("Invalid benchmark schema or case count");
  if (input.datasetKind === "reviewed" && (!text(input.review?.reviewer) || !text(input.review?.method) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(input.review?.date || ""))) throw new Error("Reviewed datasets require reviewer, method, and date metadata");
  const seenCases = new Set(), rules = new Map();
  let totalRecords = 0, duplicates = 0, falseMerges = 0, falseSplits = 0;
  const key = finding => {
    if (!finding || ![finding.scanner, finding.ruleId, finding.filePath].every(text) ||
        !Number.isSafeInteger(finding.line) || finding.line < 1) throw new Error("Invalid benchmark finding metadata");
    return JSON.stringify([finding.scanner, finding.ruleId, finding.filePath, finding.line]);
  };
  for (const item of input.cases) {
    if (!item || !text(item.id) || seenCases.has(item.id) || !text(item.language) || item.coverageComplete !== true ||
        !Array.isArray(item.expected) || !Array.isArray(item.observed)) throw new Error("Cases need unique IDs, language, complete coverage, expected and observed arrays");
    seenCases.add(item.id);
    totalRecords += item.expected.length + item.observed.length + (item.correlation?.length || 0);
    if (totalRecords > 10000) throw new Error("Benchmark exceeds 10000 metadata records");
    const rule = finding => {
      const id = JSON.stringify([item.language, finding.scanner, finding.ruleId]);
      if (!rules.has(id)) rules.set(id, { language: item.language, scanner: finding.scanner, ruleId: finding.ruleId, truePositives: 0, falsePositives: 0, falseNegatives: 0 });
      return rules.get(id);
    };
    const expected = new Map();
    for (const finding of item.expected) {
      const id = key(finding);
      if (expected.has(id)) throw new Error("Duplicate ground-truth annotation");
      expected.set(id, finding);
    }
    const seenObserved = new Set();
    for (const finding of item.observed) {
      const id = key(finding), counts = rule(finding);
      if (seenObserved.has(id)) duplicates++;
      seenObserved.add(id);
      if (expected.has(id)) { counts.truePositives++; expected.delete(id); }
      else counts.falsePositives++;
    }
    for (const finding of expected.values()) rule(finding).falseNegatives++;
    if (item.correlation !== undefined) {
      if (!Array.isArray(item.correlation)) throw new Error("Invalid correlation annotations");
      const actual = new Map(), truth = new Map(), intersections = new Map(), ids = new Set();
      for (const group of item.correlation) {
        if (![group.id, group.expectedIssue, group.actualGroup].every(text) || ids.has(group.id)) throw new Error("Correlation rows need unique IDs and both group annotations");
        ids.add(group.id);
        increment(actual, group.actualGroup); increment(truth, group.expectedIssue);
        increment(intersections, JSON.stringify([group.actualGroup, group.expectedIssue]));
      }
      const correctPairs = sumPairs(intersections);
      falseMerges += sumPairs(actual) - correctPairs;
      falseSplits += sumPairs(truth) - correctPairs;
    }
  }
  const measures = counts => ({ ...counts, precision: ratio(counts.truePositives, counts.truePositives + counts.falsePositives),
    recall: ratio(counts.truePositives, counts.truePositives + counts.falseNegatives) });
  const totals = [...rules.values()].reduce((sum, row) => ({ truePositives: sum.truePositives + row.truePositives,
    falsePositives: sum.falsePositives + row.falsePositives, falseNegatives: sum.falseNegatives + row.falseNegatives }),
  { truePositives: 0, falsePositives: 0, falseNegatives: 0 });
  return { schemaVersion: 1, datasetKind: input.datasetKind, cases: input.cases.length,
    provenance: input.datasetKind === "reviewed" ? "Review metadata supplied by dataset author; not independently authenticated by this tool." : "Synthetic regression data; not a real-world detection-rate measurement.",
    matching: "Exact scanner, rule, path and line; one-to-one. Duplicate detections count as false positives.",
    overall: measures(totals), byRule: [...rules.values()].map(measures),
    correlation: { duplicateDetections: duplicates, falseMergePairs: falseMerges, falseSplitPairs: falseSplits } };
}
module.exports = { evaluateBenchmark };

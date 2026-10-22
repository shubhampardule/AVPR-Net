const Scan = require("../models/Scan");
const Finding = require("../models/Finding");
const { bad } = require("../utils/input");
async function records(scanId) {
  const findings = await Finding.find({ scan: scanId }).sort({ riskScore: -1, _id: -1 }).limit(20001).lean();
  if (findings.length > 20000) throw bad("Export/comparison exceeds the 20000 finding limit", 413);
  return findings;
}
function comparisonBlockReason(current, previous) {
  if (!previous) return "No earlier completed scan with successful scanner runs is available. Findings are not labeled new, persistent, or fixed.";
  if (current.status !== "completed" || current.scannerErrors?.length || previous.status !== "completed" || previous.scannerErrors?.length) {
    return "Both scans must finish with every configured scanner successful before findings can be classified.";
  }
  const scanners = value => [...new Set(value || [])].sort();
  const currentScanners = scanners(current.scannersUsed), previousScanners = scanners(previous.scannersUsed);
  if (!currentScanners.length || JSON.stringify(currentScanners) !== JSON.stringify(previousScanners)) {
    return "The scans used different scanner sets, so findings are not classified as new, persistent, or fixed.";
  }
  if (!current.rulesHash || current.rulesHash !== previous.rulesHash || !current.scannerPolicyHash || current.scannerPolicyHash !== previous.scannerPolicyHash || !current.normalizerHash || current.normalizerHash !== previous.normalizerHash) {
    return "The scanner rules, scanner implementation, or finding normalization changed, so findings are not classified across these scans.";
  }
  const coverage = scan => {
    if (!Array.isArray(scan.coverage) || scan.coverage.length !== currentScanners.length) return null;
    const result = new Map();
    for (const item of scan.coverage) {
      if (!item?.scanner || result.has(item.scanner) || !item.version || item.version === "unknown" || !item.filesHash) return null;
      result.set(item.scanner, `${item.version}:${item.filesHash}`);
    }
    if (result.size !== currentScanners.length || currentScanners.some(name => !result.has(name))) return null;
    return result;
  };
  const currentCoverage = coverage(current), previousCoverage = coverage(previous);
  if (!currentCoverage || !previousCoverage || currentScanners.some(name => currentCoverage.get(name) !== previousCoverage.get(name))) {
    return "Scanner versions or covered file sets differ, so findings are not classified as new, persistent, or fixed.";
  }
  return null;
}
async function compare(scanId) {
  const scan = await Scan.findById(scanId).lean();
  if (!scan || scan.status !== "completed") throw bad("Comparison requires a completed scan");
  const previous = await Scan.findOne({ organization: scan.organization, owner: scan.owner, repo: scan.repo,
    status: "completed", createdAt: { $lt: scan.createdAt }, scannerErrors: { $size: 0 } }).sort({ createdAt: -1 }).lean();
  const current = await records(scanId), before = previous ? await records(previous._id) : [];
  const key = f => f.correlationKey || f.fingerprint;
  const currentKeys = new Set(current.map(key)), previousKeys = new Set(before.map(key));
  const limitation = comparisonBlockReason(scan, previous);
  const canCompare = !limitation;
  return { scanId, commitSha: scan.commitSha, previousScanId: previous?._id || null, canCompare, canInferFixed: canCompare,
    new: canCompare ? current.filter(f => !previousKeys.has(key(f))) : [],
    persistent: canCompare ? current.filter(f => previousKeys.has(key(f))) : [],
    fixed: canCompare ? before.filter(f => !currentKeys.has(key(f))) : [],
    limitation: limitation || "Comparison uses evidence identities; moved or edited code can change identity." };
}
async function exportScan(scanId, format) {
  const scan = await Scan.findById(scanId).lean();
  if (!scan) throw bad("Scan not found", 404);
  const findings = await records(scanId);
  if (format === "json") return { schemaVersion: 1, scan, findings };
  if (format !== "sarif") throw bad("Export format must be json or sarif");
  return { version: "2.1.0", $schema: "https://json.schemastore.org/sarif-2.1.0.json", runs: [{
    tool: { driver: { name: "AVPR-Net", informationUri: "https://avpr-psi.vercel.app" } },
    properties: { commitSha: scan.commitSha, scanId: String(scan._id), status: scan.status, coverage: scan.coverage, scannerErrors: scan.scannerErrors },
    results: findings.map(f => ({ ruleId: f.ruleId, level: ["critical", "high"].includes(f.severity) ? "error" : f.severity === "medium" ? "warning" : "note",
      message: { text: f.description || f.title }, fingerprints: { "securepatch/v1": f.fingerprint },
      locations: [{ physicalLocation: { artifactLocation: { uri: f.filePath.split("/").map(encodeURIComponent).join("/") }, region: { startLine: Math.max(1, f.startLine) } } }],
      properties: { scanner: f.scanner, riskScore: f.riskScore, riskCategory: f.riskCategory, status: f.status, reason: f.statusReason } })) }] };
}
module.exports = { compare, exportScan, records };

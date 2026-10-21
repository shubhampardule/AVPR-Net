const Scan = require("../models/Scan");
const Finding = require("../models/Finding");
const { bad } = require("../utils/input");
async function records(scanId) {
  const findings = await Finding.find({ scan: scanId }).sort({ riskScore: -1, _id: -1 }).limit(20001).lean();
  if (findings.length > 20000) throw bad("Export/comparison exceeds the 20000 finding limit", 413);
  return findings;
}
async function compare(scanId) {
  const scan = await Scan.findById(scanId).lean();
  if (!scan || scan.status !== "completed") throw bad("Comparison requires a completed scan");
  const previous = await Scan.findOne({ organization: scan.organization, owner: scan.owner, repo: scan.repo,
    status: "completed", createdAt: { $lt: scan.createdAt }, scannerErrors: { $size: 0 } }).sort({ createdAt: -1 }).lean();
  const current = await records(scanId), before = previous ? await records(previous._id) : [];
  const key = f => f.correlationKey || f.fingerprint;
  const currentKeys = new Set(current.map(key)), previousKeys = new Set(before.map(key));
  const coverageMatches = previous
    && JSON.stringify([...(scan.scannersUsed || [])].sort()) === JSON.stringify([...(previous.scannersUsed || [])].sort())
    && scan.rulesHash && scan.rulesHash === previous.rulesHash
    && scan.normalizerHash && scan.normalizerHash === previous.normalizerHash;
  const completeCoverage = previous && (scan.coverage || []).length > 0 && (scan.coverage || []).every(current => {
    const old = previous.coverage?.find(item => item.scanner === current.scanner);
    return old && old.version === current.version && current.filesHash && current.filesHash === old.filesHash;
  });
  const canInferFixed = Boolean(coverageMatches && completeCoverage && !scan.scannerErrors?.length);
  return { scanId, commitSha: scan.commitSha, previousScanId: previous?._id || null, canInferFixed,
    new: current.filter(f => !previousKeys.has(key(f))), persistent: current.filter(f => previousKeys.has(key(f))),
    fixed: canInferFixed ? before.filter(f => !currentKeys.has(key(f))) : [],
    limitation: "Comparison uses evidence identities; moved or edited code can change identity. Missing issues are only classified fixed when successful scanner, rules, file, and normalization-policy coverage match." };
}
async function exportScan(scanId, format) {
  const scan = await Scan.findById(scanId).lean();
  if (!scan) throw bad("Scan not found", 404);
  const findings = await records(scanId);
  if (format === "json") return { schemaVersion: 1, scan, findings };
  if (format !== "sarif") throw bad("Export format must be json or sarif");
  return { version: "2.1.0", $schema: "https://json.schemastore.org/sarif-2.1.0.json", runs: [{
    tool: { driver: { name: "SecurePatch", informationUri: "https://avpr-psi.vercel.app" } },
    properties: { commitSha: scan.commitSha, scanId: String(scan._id), status: scan.status, coverage: scan.coverage, scannerErrors: scan.scannerErrors },
    results: findings.map(f => ({ ruleId: f.ruleId, level: ["critical", "high"].includes(f.severity) ? "error" : f.severity === "medium" ? "warning" : "note",
      message: { text: f.description || f.title }, fingerprints: { "securepatch/v1": f.fingerprint },
      locations: [{ physicalLocation: { artifactLocation: { uri: f.filePath.split("/").map(encodeURIComponent).join("/") }, region: { startLine: Math.max(1, f.startLine) } } }],
      properties: { scanner: f.scanner, riskScore: f.riskScore, riskCategory: f.riskCategory, status: f.status, reason: f.statusReason } })) }] };
}
module.exports = { compare, exportScan, records };

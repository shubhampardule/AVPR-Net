const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");
const remediation = require("./remediation.service");
const Normalizer = require("./normalizer.service");
const Orchestrator = require("../scanners/orchestrator");
const { validateCode } = require("./code-validation");
const digest = text => createHash("sha256").update(text).digest("hex");
const {canonicalRule}=require("../utils/scanner-rule");
const {computePolicyHash}=require("../utils/patch-policy");
const { validateRemediationPatch } = require("../utils/remediation-patch-policy");
const fail = code => Object.assign(new Error(code), { code });
const sourceRoot = [path.join(__dirname,".."),__dirname].find(root=>require("node:fs").existsSync(path.join(root,"scanners/rules.yml")));
function policyHash() {
  // The API bundle has no stable source-file layout. Embed the exact build-time
  // fingerprint there; the container worker still hashes its shipped sources.
  if (typeof __AVPR_RESCAN_POLICY_HASH__ !== "undefined") return __AVPR_RESCAN_POLICY_HASH__;
  return computePolicyHash(sourceRoot);
}

function summarize(before, after, finding) {
  const target = f => f.scanner === finding.scanner && f.filePath === finding.filePath && canonicalRule(f.ruleId) === canonicalRule(finding.ruleId);
  const reproduced = before.some(f => target(f) && f.startLine <= finding.startLine && f.endLine >= finding.startLine);
  const remaining = after.filter(target).length;
  const key = f => JSON.stringify([f.scanner, f.filePath, canonicalRule(f.ruleId)]);
  const counts = new Map();
  for (const f of before) counts.set(key(f), (counts.get(key(f)) || 0) + 1);
  const introduced = [];
  for (const f of after) {
    const count = counts.get(key(f)) || 0;
    if (count) counts.set(key(f), count - 1);
    else introduced.push({ scanner: f.scanner, ruleId: canonicalRule(f.ruleId), filePath: f.filePath, line: f.startLine });
  }
  const outcome = !reproduced ? "baseline_not_reproduced" : remaining ? "target_alert_remains" : introduced.length ? "new_alerts_detected" : "target_alert_absent";
  return { status: outcome === "target_alert_absent" ? "passed" : "failed", outcome,
    baselineReproduced: reproduced, remainingTargetAlerts: remaining, introducedAlerts: introduced.length,
    newAlerts: introduced.slice(0, 50), beforeAlerts: before.length, afterAlerts: after.length,
    scope: "selected rule across the target file; rule/path alert-count comparison across the repository",
    tests: "not_executed", limitation: "Static alerts only. No proof of functional correctness or absence of vulnerabilities; moved or changed alerts with the same rule/path counts may not be distinguished." };
}

function flatten(result, root) {
  if (result.scannerErrors?.length || !["semgrep", "bandit", "secrets"].every(name => result.scannersRun?.includes(name))) throw fail("RESCAN_COVERAGE_INCOMPLETE");
  if (result.results.reduce((n, item) => n + item.findings.length, 0) > 10000) throw fail("RESCAN_RESULT_LIMIT");
  return result.results.flatMap(item => Normalizer.normalize(item.scanner, item.findings, root));
}
function comparable(before, after) {
  const signature = result => JSON.stringify(result.coverage.map(c => [c.scanner, c.version, c.scanned, c.skipped ?? null, c.filesHash]).sort((a,b)=>a[0].localeCompare(b[0])));
  if (before.coverage.some(c => !c.filesHash || !c.version || !Number.isSafeInteger(c.scanned) || (c.skipped ?? 0) > 0) ||
      signature(before) !== signature(after)) throw fail("RESCAN_COVERAGE_CHANGED");
}

async function validateRuleSpecificFix(root, finding, content) {
  if (finding.scanner !== "bandit" || canonicalRule(finding.ruleId) !== "B314" || !/\.py$/.test(finding.filePath)) return;
  // B314 is only remediated when the module uses defusedxml's parser. Merely
  // removing the flagged call makes alert-count rescans pass even when the new
  // name is undefined or defuse_stdlib() is incorrectly treated as a parser.
  const imported = content.match(/^\s*from\s+defusedxml\s+import\s+ElementTree(?:\s+as\s+([A-Za-z_]\w*))?\s*$/m);
  const alias = imported?.[1] || "ElementTree";
  const exceptionImport = content.match(/^\s*from\s+defusedxml\.common\s+import\s+DefusedXmlException(?:\s+as\s+([A-Za-z_]\w*))?\s*$/m);
  const exceptionAlias = exceptionImport?.[1] || "DefusedXmlException";
  const safeParser = Boolean(imported && new RegExp(`\\b${alias}\\.fromstring\\s*\\(`).test(content) &&
    exceptionImport && new RegExp(`\\bexcept\\s+${exceptionAlias}\\b`).test(content));
  if (!safeParser || /^\s*(?:from\s+xml\.etree\s+import\s+ElementTree|import\s+xml\.etree\.ElementTree\s+as\s+ElementTree)\s*$/m.test(content)) {
    throw fail("RESCAN_REMEDIATION_PARSER_INCOMPLETE");
  }

  const manifests = ["pyproject.toml", "setup.py", "setup.cfg", "requirements.txt"];
  const rootEntries = await fs.readdir(root);
  const dependencyFiles = [...manifests, ...rootEntries.filter(name => /^requirements[^/]*\.txt$/i.test(name))];
  let declared = false;
  for (const name of new Set(dependencyFiles)) {
    try {
      const file = await fs.readFile(path.join(root, name), "utf8");
      if (file.split(/\r?\n/).some(line => !line.trimStart().startsWith("#") &&
        /\bdefusedxml["']?\s*(?:>=|==|<=|~=|!=|=|<|>|;|\[|,|$)/i.test(line))) { declared = true; break; }
    } catch (error) { if (error.code !== "ENOENT" && error.code !== "EISDIR") throw error; }
  }
  if (!declared) throw fail("RESCAN_REMEDIATION_DEPENDENCY_MISSING");
}

async function rescanPatch({ scan, finding, patch, sourceHash, proposedHash, signal }, {
  createWorkspace = require("./workspace.service").createEphemeralWorkspace,
  createOrchestrator = () => new Orchestrator(), parser = validateCode,
} = {}) {
  if (!["semgrep", "bandit", "secrets"].includes(finding.scanner) || !/\.(?:js|jsx|ts|tsx|py)$/.test(finding.filePath)) throw fail("RESCAN_FINDING_UNSUPPORTED");
  const workspace = await createWorkspace(scan.installationId, scan.owner, scan.repo, scan.commitSha);
  let cleaned = false;
  try {
    signal.throwIfAborted();
    const root = path.resolve(workspace.workspacePath);
    const destination = path.resolve(root, finding.filePath);
    const relative = path.relative(root, destination);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw fail("RESCAN_SOURCE_MISMATCH");
    let current = root;
    for (const component of relative.split(path.sep)) {
      current = path.join(current, component);
      if ((await fs.lstat(current)).isSymbolicLink()) throw fail("RESCAN_SOURCE_MISMATCH");
    }
    if ((await fs.stat(destination)).size > require("../utils/review-source").MAX_SOURCE_BYTES) throw fail("RESCAN_SOURCE_MISMATCH");
    const original = await fs.readFile(destination, "utf8");
    if (digest(original) !== sourceHash) throw fail("RESCAN_SOURCE_MISMATCH");
    const content = remediation.applyExactDiff(original, patch, finding.filePath);
    if (digest(content) !== proposedHash) throw fail("RESCAN_PATCH_MISMATCH");
    validateRemediationPatch(finding, content);
    await validateRuleSpecificFix(root, finding, content);
    const suppressions = text => (text.match(/\b(?:nosemgrep|nosec)\b/gi)||[]).length;
    if(suppressions(content)>suppressions(original)) throw fail("RESCAN_SUPPRESSION_ADDED");
    const language = /\.py$/.test(finding.filePath) ? "python" : /\.tsx?$/.test(finding.filePath) ? "typescript" : "javascript";
    const syntax = await parser(language, content);
    if (syntax.status !== "passed") throw fail(syntax.status === "failed" ? "RESCAN_SYNTAX_FAILED" : "RESCAN_SYNTAX_UNAVAILABLE");
    const beforeResult = await createOrchestrator().runAll(root);
    const before = flatten(beforeResult, root);
    signal.throwIfAborted();
    await fs.writeFile(destination, content);
    // WSL adapters snapshot the host workspace; discard the baseline copy before rescanning.
    await require("../scanners/process").cleanupWslWorkspace(root);
    const afterResult = await createOrchestrator().runAll(root);
    const after = flatten(afterResult, root);
    comparable(beforeResult, afterResult);
    signal.throwIfAborted();
    const result = { ...summarize(before, after, finding), sourceHash, proposedHash, patchHash: digest(patch),
      commitSha: scan.commitSha, coverage: afterResult.coverage.map(c => ({scanner:c.scanner,version:c.version,scanned:c.scanned,filesHash:c.filesHash})),
      rulesHash: digest(await fs.readFile(path.join(sourceRoot, "scanners/rules.yml"))), policyHash:policyHash() };
    await workspace.cleanup(); cleaned = true;
    return result;
  } finally { if (!cleaned) await workspace.cleanup(); }
}
module.exports = { rescanPatch, summarize, comparable, validateRuleSpecificFix, canonicalRule, digest, policyHash };

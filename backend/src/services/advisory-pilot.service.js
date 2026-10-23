const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { cleanupWslWorkspace } = require("../scanners/process");
const defaultManifest = require("../../fixtures/advisory-pilot.json");
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const MAX_BYTES = 1024 * 1024;

function validateManifest(manifest) {
  if (manifest?.schemaVersion !== 1 || manifest.datasetKind !== "advisory-pilot" ||
      !Array.isArray(manifest.cases) || !manifest.cases.length || manifest.cases.length > 10) throw new Error("Invalid pilot manifest");
  const ids = new Set();
  for (const item of manifest.cases) {
    if (!/^[a-z0-9-]{1,80}$/.test(item.id) || ids.has(item.id) ||
        !/^[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(item.repository) ||
        !/^[a-f0-9]{40}$/.test(item.before) || !/^[a-f0-9]{40}$/.test(item.after) ||
        !/^https:\/\/github\.com\/advisories\/GHSA-[a-z0-9-]+$/.test(item.advisory) ||
        !Array.isArray(item.files) || !item.files.length || item.files.length > 10 ||
        !item.rules || !Object.keys(item.rules).length || Object.entries(item.rules).some(([scanner, rule]) =>
          !["semgrep", "bandit"].includes(scanner) || typeof rule !== "string" || !/^[A-Za-z0-9_.-]+$/.test(rule))) throw new Error("Invalid pilot case");
    ids.add(item.id);
    const paths = new Set();
    for (const file of item.files) {
      if (typeof file.path !== "string" || !/^[A-Za-z0-9_./-]+\.(?:py|js|ts)$/.test(file.path) ||
          file.path.split("/").some(part => !part || part === "." || part === "..") || paths.has(file.path) ||
          !/^[a-f0-9]{64}$/.test(file.beforeSha256) || !/^[a-f0-9]{64}$/.test(file.afterSha256) ||
          [file.targetLinesBefore, file.targetLinesAfter].some(lines => !Array.isArray(lines) || !lines.length || lines.length > 100 ||
            new Set(lines).size !== lines.length || lines.some(line => !Number.isSafeInteger(line) || line < 1))) throw new Error("Invalid pilot file");
      paths.add(file.path);
    }
  }
}

async function downloadPinned(url, expectedHash, fetchImpl = fetch) {
  const response = await fetchImpl(url, { redirect: "error", signal: AbortSignal.timeout(15000) });
  if (!response.ok || !response.body || Number(response.headers.get("content-length")) > MAX_BYTES) throw new Error("Pilot download unavailable");
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BYTES) throw new Error("Pilot source exceeds limit");
      chunks.push(Buffer.from(value));
    }
  } finally { await reader.cancel(); reader.releaseLock(); }
  const bytes = Buffer.concat(chunks);
  if (!bytes.length || sha256(bytes) !== expectedHash) throw new Error("Pilot source hash mismatch");
  return bytes;
}

function observations(scanner, findings, root, allowedPaths) {
  return findings.map(finding => {
    const raw = scanner === "semgrep" ? finding.path : finding.filename;
    if (typeof raw !== "string") throw new Error("Pilot scanner returned an invalid path");
    const file = (path.isAbsolute(raw) ? path.relative(root, raw) : raw).replace(/\\/g, "/").replace(/^\.\//, "");
    const rawRule = scanner === "semgrep" ? finding.check_id : finding.test_id;
    const rule = scanner === "semgrep" && typeof rawRule === "string" ? rawRule.slice(rawRule.indexOf("securepatch.")) : rawRule;
    const line = scanner === "semgrep" ? finding.start?.line : finding.line_number;
    const end = scanner === "semgrep" ? finding.end?.line : finding.line_number;
    if (!allowedPaths.has(file) || typeof rule !== "string" || !/^(securepatch\.[a-z0-9.-]+|B\d{3})$/.test(rule) ||
        !Number.isSafeInteger(line) || line < 1 || !Number.isSafeInteger(end) || end < line) throw new Error("Pilot scanner returned invalid metadata");
    return { scanner, rule, file, line, end };
  }).sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule));
}

function summarizeTargets(manifest, revision, findings) {
  const reports = [];
  for (const item of manifest.cases) for (const [scanner, rule] of Object.entries(item.rules)) {
    const targets = item.files.flatMap(file => file[revision === "before" ? "targetLinesBefore" : "targetLinesAfter"].map(line => ({
      file: `${item.repository}/${file.path}`, line,
    })));
    const relevant = findings.filter(f => f.scanner === scanner && f.rule === rule && f.file.startsWith(`${item.repository}/`));
    reports.push({ case: item.id, scanner, rule, targetSites: targets.length,
      sitesWithAlert: targets.filter(t => relevant.some(f => f.file === t.file && f.line <= t.line && f.end >= t.line)).length,
      otherAlerts: relevant.filter(f => !targets.some(t => f.file === t.file && f.line <= t.line && f.end >= t.line)).length });
  }
  return reports;
}

async function runPilot({ manifest = defaultManifest, fetchImpl = fetch, adapterFactory = name => {
  const Adapter = require(`../scanners/${name}.adapter`);
  return new Adapter();
} } = {}) {
  validateManifest(manifest);
  const scanners = [...new Set(manifest.cases.flatMap(item => Object.keys(item.rules)))];
  const adapters = {};
  for (const name of scanners) {
    const adapter = adapterFactory(name);
    if (!await adapter.isAvailable()) throw new Error(`Required pilot scanner unavailable: ${name}`);
    adapters[name] = adapter;
  }
  const report = { schemaVersion: 1, datasetKind: "advisory-pilot", annotationStatus: "project-authored, not independently reviewed",
    manifestSha256: sha256(JSON.stringify(manifest)), rulesSha256: sha256(await fs.readFile(path.join(__dirname, "../scanners/rules.yml"))),
    generatedAt: new Date().toISOString(), sources: manifest.cases, versions: Object.fromEntries(scanners.map(name => [name, adapters[name].version])),
    revisions: {}, limitations: ["Two selected public fixes; not a representative or independently reviewed benchmark.",
      "Alerts are static review signals, not exploit confirmation. No repository code, tests, or install hooks were executed.",
      "Other alerts are unadjudicated; no precision, recall, clean-repository, or correlation-quality claim is made.",
      "Target labels were authored from published fixes; neither blinded nor independent. Only selected files were scanned."] };
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "avpr-advisory-"));
  try {
    for (const revision of ["before", "after"]) {
      const workspace = path.join(temporaryRoot, revision);
      const allowed = new Set();
      for (const item of manifest.cases) for (const file of item.files) {
        const relative = `${item.repository}/${file.path}`;
        const bytes = await downloadPinned(`https://raw.githubusercontent.com/${item.repository}/${item[revision]}/${file.path}`,
          file[`${revision}Sha256`], fetchImpl);
        const destination = path.join(workspace, relative);
        await fs.mkdir(path.dirname(destination), { recursive: true });
        await fs.writeFile(destination, bytes, { flag: "wx" });
        allowed.add(relative);
      }
      const findings = [];
      const coverage = {};
      for (const scanner of scanners) {
        const adapter = adapters[scanner];
        findings.push(...observations(scanner, await adapter.scan(workspace), workspace, allowed));
        const expectedFiles = [...allowed].filter(file => scanner !== "bandit" || file.endsWith(".py")).sort();
        if (adapter.coverage?.scanned !== expectedFiles.length || (adapter.coverage?.skipped ?? 0) !== 0 ||
            adapter.coverage?.filesHash !== sha256(JSON.stringify(expectedFiles))) throw new Error("Pilot scanner coverage incomplete");
        coverage[scanner] = { scannedFiles: adapter.coverage.scanned };
      }
      report.revisions[revision] = { coverage, targets: summarizeTargets(manifest, revision, findings), observations: findings };
    }
  } finally {
    try {
      const results = await Promise.allSettled(["before", "after"].map(revision => cleanupWslWorkspace(path.join(temporaryRoot, revision))));
      if (results.some(result => result.status === "rejected")) throw new Error("Pilot WSL cleanup incomplete");
    }
    finally {
      if (path.dirname(temporaryRoot) !== os.tmpdir() || !/^avpr-advisory-[A-Za-z0-9]+$/.test(path.basename(temporaryRoot))) throw new Error("Unsafe pilot cleanup path");
      await fs.rm(temporaryRoot, { recursive: true, force: true });
    }
  }
  return report;
}
module.exports = { validateManifest, downloadPinned, observations, summarizeTargets, runPilot };

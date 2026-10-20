const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const Orchestrator = require("../scanners/orchestrator");
const Semgrep = require("../scanners/semgrep.adapter");
const Bandit = require("../scanners/bandit.adapter");

const expectedSemgrep = new Set([
  "unsafe.js:securepatch.js.dynamic-eval",
  "unsafe.js:securepatch.js.shell-exec",
  "unsafe.js:securepatch.js.raw-html",
  "unsafe.js:securepatch.js.weak-hash",
  "unsafe.js:securepatch.js.sql-concatenation",
  "unsafe.js:securepatch.js.disabled-tls",
  "unsafe.js:securepatch.js.jwt-unverified",
  "unsafe.py:securepatch.python.pickle",
  "unsafe.py:securepatch.python.dynamic-eval",
  "unsafe.py:securepatch.python.shell",
  "unsafe.py:securepatch.python.sql-formatting",
  "unsafe.py:securepatch.python.insecure-yaml",
]);

async function main() {
  const fixtureRoot = process.argv[2] || "/fixtures";
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "securepatch-sast-v1-"));
  try {
    const repositoryFixtureScan = await new Orchestrator([new Semgrep(), new Bandit()]).runAll(fixtureRoot);
    assert.equal(repositoryFixtureScan.scannerErrors.length, 0, "Scanners must run on the fixture directory");
    const fixtureFindings = repositoryFixtureScan.results.flatMap((item) => item.findings);
    assert.deepEqual(fixtureFindings, [], "Fixture-only source files must not appear as product findings in a normal repository scan");

    await Promise.all([
      fs.copyFile(path.join(fixtureRoot, "unsafe.javascript.fixture"), path.join(workspace, "unsafe.js")),
      fs.copyFile(path.join(fixtureRoot, "fixed.javascript.fixture"), path.join(workspace, "fixed.js")),
      fs.copyFile(path.join(fixtureRoot, "unsafe.python.fixture"), path.join(workspace, "unsafe.py")),
      fs.copyFile(path.join(fixtureRoot, "fixed.python.fixture"), path.join(workspace, "fixed.py")),
    ]);

    const result = await new Orchestrator([new Semgrep(), new Bandit()]).runAll(workspace);
    assert.equal(result.scannerErrors.length, 0, "All configured scanners must work");

    const semgrep = result.results.find((item) => item.scanner === "semgrep")?.findings || [];
    const actualSemgrep = new Set(semgrep.map((finding) => {
      const checkId = String(finding.check_id);
      const ruleOffset = checkId.lastIndexOf("securepatch.");
      const ruleId = ruleOffset >= 0 ? checkId.slice(ruleOffset) : checkId;
      return `${path.basename(finding.path)}:${ruleId}`;
    }));
    const missedRules = [...expectedSemgrep].filter((key) => !actualSemgrep.has(key));
    const unexpectedSemgrep = [...actualSemgrep].filter((key) => !expectedSemgrep.has(key));
    if (missedRules.length || unexpectedSemgrep.length) {
      console.error(JSON.stringify({ semgrep: semgrep.map((finding) => ({ path: finding.path, checkId: finding.check_id })), coverage: result.coverage }));
    }
    assert.deepEqual(missedRules, [], `Semgrep missed baseline cases: ${missedRules.join(", ")}`);
    assert.deepEqual(unexpectedSemgrep, [], `Semgrep produced findings outside baseline cases: ${unexpectedSemgrep.join(", ")}`);

    const bandit = result.results.find((item) => item.scanner === "bandit")?.findings || [];
    const banditUnsafe = bandit.filter((finding) => path.basename(finding.filename) === "unsafe.py");
    const banditFixed = bandit.filter((finding) => path.basename(finding.filename) === "fixed.py");
    assert.ok(banditUnsafe.some((finding) => finding.test_id === "B602"), "Bandit must detect the shell=True contract");
    assert.deepEqual(banditFixed, [], "Bandit must not report the safe Python fixture");

    console.log(JSON.stringify({
      status: "passed",
      benchmark: "securepatch-sast-v1",
      scanners: result.coverage,
      baseline: {
        semgrep: { expectedCases: expectedSemgrep.size, detectedCases: expectedSemgrep.size, misses: 0, unexpectedFindings: 0 },
        bandit: { shellExecutionCases: 1, detectedShellExecutionCases: 1, findingsInFixedPython: 0 },
        fixtureSourceFindings: 0,
      },
      interpretation: "Synthetic regression coverage only; these counts are not real-world precision or recall estimates.",
    }));
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });

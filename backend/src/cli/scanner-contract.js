const assert = require("node:assert/strict");
const Orchestrator = require("../scanners/orchestrator");
const Semgrep = require("../scanners/semgrep.adapter");
const Bandit = require("../scanners/bandit.adapter");
(async () => {
  const result = await new Orchestrator([new Semgrep(), new Bandit()]).runAll(process.argv[2] || "/fixtures");
  assert.equal(result.scannerErrors.length, 0, "All configured scanners must work");
  assert.ok(result.results.find(r => r.scanner === "semgrep")?.findings.length >= 2, "SQL and eval fixtures must be detected");
  assert.ok(result.results.find(r => r.scanner === "bandit")?.findings.length >= 1, "Python shell fixture must be detected");
  console.log(JSON.stringify({ status: "passed", scanners: result.scannersRun, coverage: result.coverage }));
})().catch(error => { console.error(error.message); process.exitCode = 1; });

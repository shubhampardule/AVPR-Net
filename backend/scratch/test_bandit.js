const path = require('path');
const fs = require('fs');
const os = require('os');
const ScannerOrchestrator = require('../src/scanners/orchestrator');

(async () => {
  // Create temporary workspace
  const workspace = path.join(os.tmpdir(), `bandit-test-${Date.now()}`);
  fs.mkdirSync(workspace, { recursive: true });
  // Write insecure python file
  const insecureCode = `import os\nos.system("ls")\n`;
  fs.writeFileSync(path.join(workspace, 'insecure.py'), insecureCode);

  console.log('Workspace created at', workspace);

  const orchestrator = new ScannerOrchestrator();
  try {
    const { results, scannersRun } = await orchestrator.runAll(workspace);
    console.log('Scanners run:', scannersRun);
    for (const { scanner, findings } of results) {
      console.log('--- Scanner:', typeof scanner === 'object' ? scanner.name : scanner);
      console.log('Findings count:', findings.length);
      console.log(JSON.stringify(findings, null, 2));
    }
  } catch (err) {
    console.error('Error during scanning:', err);
  } finally {
    // Cleanup workspace
    fs.rmSync(workspace, { recursive: true, force: true });
    console.log('Workspace cleaned up');
  }
})();

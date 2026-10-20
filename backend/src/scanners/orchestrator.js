const SemgrepAdapter = require("./semgrep.adapter");
const BanditAdapter = require("./bandit.adapter");

class ScannerOrchestrator {
  constructor(adapters = null, { includeDependencies = false } = {}) {
    this.adapters = adapters || [
      new SemgrepAdapter(),
      new BanditAdapter(),
      new (require("./repository-data.adapter").SecretsAdapter)(),
      ...(includeDependencies ? [new (require("./repository-data.adapter").DependencyAdapter)()] : []),
    ];
  }

  /**
   * Runs available adapters against the workspace
   * @param {string} workspacePath
   * @returns {Promise<Array<{ scanner: string, findings: Array<any> }>>}
   */
  async runAll(workspacePath) {
    const results = [];
    const scannersRun = [];
    const scannerErrors = [];
    const coverage = [];
    let anyAvailable = false;

    for (const adapter of this.adapters) {
      const isAvail = await adapter.isAvailable();
      if (isAvail) {
        anyAvailable = true;
        try {
          const rawFindings = await adapter.scan(workspacePath);
          results.push({
            scanner: adapter.name,
            findings: rawFindings,
          });
          scannersRun.push(adapter.name);
          coverage.push({ scanner: adapter.name, version: adapter.version || "unknown", ...adapter.coverage });
        } catch (scanErr) {
          scannerErrors.push({
            scanner: adapter.name,
            message: scanErr.message,
            exitCode: scanErr.exitCode ?? null,
            stderr: scanErr.stderr || "",
          });
          console.error(`[Scanner Error] ${adapter.name} failed during scan:`, scanErr.message);
        }
      } else {
        console.info(`[Scanner Notice] ${adapter.name} is not installed or available on this system.`);
        scannerErrors.push({
          scanner: adapter.name,
          message: "Scanner executable was not available on PATH.",
        });
      }
    }

    if (!anyAvailable) {
      const err = new Error("No supported security scanners (Semgrep, Bandit) were found installed on the system PATH.");
      err.code = "SCANNER_UNAVAILABLE";
      throw err;
    }

    if (!scannersRun.length) {
      throw Object.assign(new Error("Every available scanner failed; no valid analysis was produced."),
        { code: "ALL_SCANNERS_FAILED", scannerErrors });
    }
    return {
      results,
      scannersRun,
      scannerErrors,
      coverage,
    };
  }
}

module.exports = ScannerOrchestrator;

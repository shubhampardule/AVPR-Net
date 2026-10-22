const BaseScannerAdapter = require("./base.adapter");
const { run, scanJSON } = require("./process");
class Adapter extends BaseScannerAdapter {
  constructor() { super("semgrep"); }
  async isAvailable() {
    try { this.version = (await run("semgrep", ["--version"], { timeout: process.env.SECUREPATCH_SCANNER_WSL_DISTRO ? 30000 : 5000 })).stdout.trim(); return true; }
    catch { return false; }
  }
  async scan(workspacePath) {
    const scanTarget = process.env.SECUREPATCH_SCANNER_WSL_DISTRO && process.platform === "win32" ? "." : workspacePath;
    const parsed = await scanJSON("semgrep", ["scan", "--config", require("node:path").join(__dirname, "rules.yml"), "--json", "--quiet", "--metrics", "off", "--disable-version-check", scanTarget], workspacePath);
    this.coverage = require("./process").coverage(parsed.paths?.scanned || [], workspacePath, parsed.paths?.skipped?.length ?? null);
    return parsed.results;
  }
}
module.exports = Adapter;

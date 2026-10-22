const BaseScannerAdapter = require("./base.adapter");
const { run, scanJSON } = require("./process");
class Adapter extends BaseScannerAdapter {
  constructor() { super("bandit"); }
  async isAvailable() {
    try { this.version = (await run("bandit", ["--version"], { timeout: process.env.SECUREPATCH_SCANNER_WSL_DISTRO ? 30000 : 5000 })).stdout.trim(); return true; }
    catch { return false; }
  }
  async scan(workspacePath) {
    const scanTarget = process.env.SECUREPATCH_SCANNER_WSL_DISTRO && process.platform === "win32" ? "." : workspacePath;
    const parsed = await scanJSON("bandit", ["-r", scanTarget, "-f", "json", "-q"], workspacePath);
    this.coverage = require("./process").coverage(Object.keys(parsed.metrics || {}).filter(key => key !== "_totals"), workspacePath);
    return parsed.results;
  }
}
module.exports = Adapter;

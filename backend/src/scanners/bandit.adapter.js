const { execFile, execFileSync } = require("child_process");
const BaseScannerAdapter = require("./base.adapter");

let cachedEnvPath = null;
function getExecutionEnv() {
  if (!cachedEnvPath) {
    let envPath = process.env.PATH || process.env.Path || "";
    if (process.platform === "win32") {
      try {
        const out = execFileSync("reg", ["query", "HKCU\\Environment", "/v", "Path"], { encoding: "utf8" });
        const match = out.match(/Path\s+REG_\w+\s+(.*)/i);
        if (match && match[1]) {
          const userPath = match[1].trim();
          if (!envPath.includes(userPath)) {
            envPath = `${envPath};${userPath}`;
          }
        }
      } catch (_) {}
    }
    cachedEnvPath = envPath;
  }
  return { ...process.env, PATH: cachedEnvPath };
}

class BanditAdapter extends BaseScannerAdapter {
  constructor() {
    super("bandit");
  }

  async isAvailable() {
    return new Promise((resolve) => {
      execFile("bandit", ["--version"], { env: getExecutionEnv(), timeout: 5000 }, (error) => {
        resolve(!error);
      });
    });
  }

  async scan(workspacePath) {
    const available = await this.isAvailable();
    if (!available) {
      const err = new Error("Bandit binary is not available or not installed on system path.");
      err.code = "SCANNER_UNAVAILABLE";
      throw err;
    }

    return new Promise((resolve, reject) => {
      const args = ["-r", workspacePath, "-f", "json", "-q"];

      execFile(
        "bandit",
        args,
        {
          env: getExecutionEnv(),
          maxBuffer: 20 * 1024 * 1024,
          cwd: workspacePath,
        },
        (error, stdout, stderr) => {
          // Bandit returns 1 if issues are found, 0 if clean
          if (stdout && stdout.trim().length > 0) {
            try {
              const parsed = JSON.parse(stdout);
              return resolve(parsed.results || []);
            } catch (jsonErr) {
              return reject(new Error(`Failed to parse Bandit output: ${jsonErr.message}`));
            }
          }

          if (error && error.code !== 1) {
            return reject(new Error(`Bandit execution failed: ${stderr || error.message}`));
          }

          return resolve([]);
        }
      );
    });
  }
}

module.exports = BanditAdapter;

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

class SemgrepAdapter extends BaseScannerAdapter {
  constructor() {
    super("semgrep");
  }

  async isAvailable() {
    return new Promise((resolve) => {
      execFile("semgrep", ["--version"], { env: getExecutionEnv(), timeout: 5000 }, (error, stdout) => {
        if (!error) this.version = stdout.trim();
        resolve(!error);
      });
    });
  }

  async scan(workspacePath) {
    const available = await this.isAvailable();
    if (!available) {
      const err = new Error("Semgrep binary is not available or not installed on system path.");
      err.code = "SCANNER_UNAVAILABLE";
      throw err;
    }

    return new Promise((resolve, reject) => {
      // Run semgrep using standard auto/p/default rules in JSON mode
      // Setting maxBuffer to 20MB for large outputs
      const args = ["scan", "--config", "auto", "--json", "--quiet", workspacePath];
      console.info(
        `[Scanner] semgrep version=${this.version || "unknown"} command=semgrep ${args.join(" ")}`
      );

      execFile(
        "semgrep",
        args,
        {
          env: getExecutionEnv(),
          maxBuffer: 20 * 1024 * 1024,
          cwd: workspacePath,
        },
        (error, stdout, stderr) => {
          // Semgrep returns exit code 1 if findings are found, or 0 if none found.
          // It exits > 1 on internal errors.
          if (stdout && stdout.trim().length > 0) {
            try {
              const parsed = JSON.parse(stdout);
              console.info(
                `[Scanner] semgrep exitCode=${error?.code ?? 0} rawFindings=${parsed.results?.length || 0} stdoutBytes=${Buffer.byteLength(stdout)} stderrBytes=${Buffer.byteLength(stderr || "")}`
              );
              return resolve(parsed.results || []);
            } catch (jsonErr) {
              return reject(new Error(`Failed to parse Semgrep output: ${jsonErr.message}`));
            }
          }

          if (error && error.code !== 1) {
            const scanError = new Error(`Semgrep execution failed: ${stderr || error.message}`);
            scanError.exitCode = Number.isInteger(error.code) ? error.code : undefined;
            scanError.stderr = stderr || "";
            return reject(scanError);
          }

          console.info(
            `[Scanner] semgrep exitCode=${error?.code ?? 0} rawFindings=0 stdoutBytes=0 stderrBytes=${Buffer.byteLength(stderr || "")}`
          );
          return resolve([]);
        }
      );
    });
  }
}

module.exports = SemgrepAdapter;

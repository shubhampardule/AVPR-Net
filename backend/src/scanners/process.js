const { execFile } = require("node:child_process");
const os = require("node:os");
const path = require("node:path");
function scannerEnv() {
  return Object.fromEntries(Object.entries({
    PATH: process.env.PATH || process.env.Path, SystemRoot: process.env.SystemRoot,
    TEMP: os.tmpdir(), TMP: os.tmpdir(), LANG: "C.UTF-8",
    SEMGREP_SEND_METRICS: "off", SEMGREP_ENABLE_VERSION_CHECK: "0",
    SEMGREP_SETTINGS_FILE: path.join(os.tmpdir(), "securepatch-semgrep-settings.yml"),
    SEMGREP_LOG_FILE: path.join(os.tmpdir(), "securepatch-semgrep.log"),
    SEMGREP_VERSION_CACHE_PATH: path.join(os.tmpdir(), "securepatch-semgrep-version"),
  }).filter(([, value]) => value));
}
function run(binary, args, { cwd, timeout = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    let child;
    child = execFile(binary, args, { cwd, env: scannerEnv(), timeout, killSignal: "SIGKILL",
      detached: process.platform !== "win32",
      signal: require("../services/scan-context").getStore()?.signal,
      maxBuffer: 20 * 1024 * 1024, windowsHide: true }, (error, stdout, stderr) => {
      const exitCode = error ? error.code : 0;
      if (error && ![0, 1].includes(exitCode)) {
        // Semgrep may spawn a core process. Terminate the entire isolated group.
        if (process.platform !== "win32" && child?.pid) {
          try { process.kill(-child.pid, "SIGKILL"); } catch { /* Already exited. */ }
        } else if (process.platform === "win32" && child?.pid) {
          execFile("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true }, () => {});
        }
        return reject(Object.assign(new Error(`${binary} failed${error.killed ? " (deadline exceeded)" : ""}`),
          { code: "SCANNER_FAILED", exitCode: Number.isInteger(exitCode) ? exitCode : null }));
      }
      resolve({ stdout, stderr, exitCode });
    });
  });
}
async function scanJSON(binary, args, cwd) {
  const { stdout } = await run(binary, args, { cwd });
  let parsed;
  try { parsed = JSON.parse(stdout); } catch { throw new Error(`${binary} returned malformed JSON`); }
  if (!parsed || !Array.isArray(parsed.results) ||
    (parsed.errors !== undefined && (!Array.isArray(parsed.errors) || parsed.errors.length))) {
    throw new Error(`${binary} reported analysis errors or an invalid result`);
  }
  return parsed;
}
module.exports = { run, scanJSON, scannerEnv };
module.exports.coverage = (paths, root, skipped = null) => ({
  scanned: paths.length, skipped,
  filesHash: require("node:crypto").createHash("sha256").update(JSON.stringify(paths.map(p => path.relative(root, p).replace(/\\/g, "/")).sort())).digest("hex"),
});

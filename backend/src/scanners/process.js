const { execFile } = require("node:child_process");
const os = require("node:os");
const path = require("node:path");
const wslWorkspaces = new Map();
function scannerEnv() {
  const scannerBinDir = process.env.SECUREPATCH_SCANNER_BIN_DIR;
  const inheritedPath = process.env.PATH || process.env.Path;
  const searchPath = [scannerBinDir, inheritedPath].filter(Boolean).join(path.delimiter);
  return Object.fromEntries(Object.entries({
    PATH: searchPath, SystemRoot: process.env.SystemRoot,
    TEMP: os.tmpdir(), TMP: os.tmpdir(), LANG: "C.UTF-8",
    SEMGREP_SEND_METRICS: "off", SEMGREP_ENABLE_VERSION_CHECK: "0",
    SEMGREP_SETTINGS_FILE: path.join(os.tmpdir(), "securepatch-semgrep-settings.yml"),
    SEMGREP_LOG_FILE: path.join(os.tmpdir(), "securepatch-semgrep.log"),
    SEMGREP_VERSION_CACHE_PATH: path.join(os.tmpdir(), "securepatch-semgrep-version"),
  }).filter(([, value]) => value));
}
function wslUtility(args, timeout = 30000) {
  return new Promise((resolve, reject) => {
    execFile("wsl.exe", ["--distribution", process.env.SECUREPATCH_SCANNER_WSL_DISTRO, "--exec", ...args], {
      env: scannerEnv(), timeout, windowsHide: true, maxBuffer: 1024 * 1024,
    }, (error, stdout, stderr) => {
      if (error) return reject(new Error(`WSL scanner workspace setup failed (${error.code || stderr.trim() || "command failed"})`));
      resolve(stdout.trim());
    });
  });
}
function toWslPath(value) {
  if (typeof value !== "string" || !/^[a-z]:[\\/]/i.test(value)) return Promise.resolve(value);
  return wslUtility(["wslpath", "-a", value], 5000);
}
async function prepareWslWorkspace(hostPath) {
  const key = path.resolve(hostPath);
  if (wslWorkspaces.has(key)) return wslWorkspaces.get(key);
  const workspacePromise = (async () => {
    let destination;
    try {
      const source = await toWslPath(hostPath);
      destination = await wslUtility(["mktemp", "-d", "/tmp/securepatch-scan-XXXXXX"]);
      if (!/^\/tmp\/securepatch-scan-[A-Za-z0-9]+$/.test(destination)) throw new Error("WSL returned an invalid temporary workspace path");
      await wslUtility(["cp", "-a", "--", `${source.replace(/\/$/, "")}/.`, destination], 60000);
      return destination;
    } catch (error) {
      if (destination && /^\/tmp\/securepatch-scan-[A-Za-z0-9]+$/.test(destination)) {
        await wslUtility(["rm", "-rf", "--", destination]).catch(() => {});
      }
      throw error;
    }
  })();
  wslWorkspaces.set(key, workspacePromise);
  try { return await workspacePromise; }
  catch (error) { wslWorkspaces.delete(key); throw error; }
}
async function cleanupWslWorkspace(hostPath) {
  if (!hostPath) return;
  const key = path.resolve(hostPath);
  const workspace = wslWorkspaces.get(key);
  wslWorkspaces.delete(key);
  if (!workspace) return;
  const destination = await workspace;
  if (/^\/tmp\/securepatch-scan-[A-Za-z0-9]+$/.test(destination)) {
    await wslUtility(["rm", "-rf", "--", destination], 10000);
  }
}
function runInWsl(binary, args, { cwd, timeout }) {
  const distro = process.env.SECUREPATCH_SCANNER_WSL_DISTRO;
  const scannerDir = process.env.SECUREPATCH_SCANNER_WSL_BIN_DIR;
  const executable = scannerDir ? path.posix.join(scannerDir, binary) : binary;
  const translate = (value) => typeof value === "string" && /^[a-z]:[\\/]/i.test(value) ? toWslPath(value) : Promise.resolve(value);
  const translatedCwd = cwd ? prepareWslWorkspace(cwd) : Promise.resolve(undefined);
  return Promise.all([translatedCwd, ...args.map(translate)]).then(([workspacePath, ...translatedArgs]) => new Promise((resolve, reject) => {
    execFile("wsl.exe", ["--distribution", distro, ...(workspacePath ? ["--cd", workspacePath] : []), "--exec", "timeout", "--signal=KILL", `${Math.ceil(timeout / 1000)}s`, executable, ...translatedArgs], {
      cwd, env: scannerEnv(), timeout, killSignal: "SIGKILL", maxBuffer: 20 * 1024 * 1024, windowsHide: true,
      signal: require("../services/scan-context").getStore()?.signal,
    }, (error, stdout, stderr) => {
      const exitCode = error ? error.code : 0;
      if (error && ![0, 1].includes(exitCode)) {
        return reject(Object.assign(new Error(`${binary} failed${error.killed ? " (deadline exceeded)" : ""}`),
          { code: "SCANNER_FAILED", exitCode: Number.isInteger(exitCode) ? exitCode : null }));
      }
      resolve({ stdout, stderr, exitCode });
    });
  }));
}
function run(binary, args, { cwd, timeout = 120000 } = {}) {
  if (process.env.SECUREPATCH_SCANNER_WSL_DISTRO) return runInWsl(binary, args, { cwd, timeout });
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
module.exports = { run, scanJSON, scannerEnv, cleanupWslWorkspace };
module.exports.coverage = (paths, root, skipped = null) => ({
  scanned: paths.length, skipped,
  filesHash: require("node:crypto").createHash("sha256").update(JSON.stringify(paths.map(p =>
    path.isAbsolute(p) || path.win32.isAbsolute(p) ? path.relative(root, p).replace(/\\/g, "/") : String(p).replace(/\\/g, "/").replace(/^\.\//, "")
  ).sort())).digest("hex"),
});

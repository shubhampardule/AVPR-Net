jest.mock("node:child_process", () => ({ execFile: jest.fn() }));
const { execFile } = require("node:child_process");
const { scanJSON, scannerEnv, cleanupWslWorkspace } = require("../src/scanners/process");
beforeEach(() => jest.clearAllMocks());
afterEach(() => {
  delete process.env.SECUREPATCH_SCANNER_BIN_DIR;
  delete process.env.SECUREPATCH_SCANNER_PYTHON;
  delete process.env.SECUREPATCH_SCANNER_WSL_DISTRO;
  delete process.env.SECUREPATCH_SCANNER_WSL_BIN_DIR;
});
test("fatal scanner exit is rejected even with valid JSON", async () => {
  execFile.mockImplementation((binary, args, options, callback) => callback(Object.assign(new Error("fatal"), { code: 2 }), '{"results":[]}', ""));
  await expect(scanJSON("semgrep", [], "synthetic")).rejects.toMatchObject({ code: "SCANNER_FAILED" });
});
test.each([0, 1])("scanner exit %s accepts valid findings with no analysis errors", async code => {
  execFile.mockImplementation((binary, args, options, callback) => callback(code ? { code } : null, '{"results":[],"errors":[]}', ""));
  await expect(scanJSON("semgrep", [], "synthetic")).resolves.toMatchObject({ results: [] });
  expect(execFile.mock.calls[0][2]).toMatchObject({ timeout: 120000, killSignal: "SIGKILL", windowsHide: true });
});
test("scanner directory is prepended when resolving subprocesses", async () => {
  const originalPath = process.env.PATH;
  process.env.SECUREPATCH_SCANNER_BIN_DIR = "scanner-bin";
  process.env.PATH = "system-bin";
  try {
    expect(scannerEnv().PATH.split(require("node:path").delimiter).slice(0, 2)).toEqual(["scanner-bin", "system-bin"]);
  } finally {
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
  }
});
test("scanner executables are invoked by their regular command names", async () => {
  execFile.mockImplementation((binary, args, options, callback) => callback(null, '{"results":[]}', ""));
  await expect(scanJSON("bandit", ["--version"], "synthetic")).resolves.toMatchObject({ results: [] });
  expect(execFile.mock.calls[0][0]).toBe("bandit");
  expect(execFile.mock.calls[0][1]).toEqual(["--version"]);
});
test("optional WSL mode translates Windows paths and keeps scanner execution isolated", async () => {
  process.env.SECUREPATCH_SCANNER_WSL_DISTRO = "Ubuntu";
  process.env.SECUREPATCH_SCANNER_WSL_BIN_DIR = "/home/test/.local/share/securepatch-scanners/bin";
  execFile.mockImplementation((binary, args, options, callback) => {
    if (args.includes("wslpath")) return callback(null, args.at(-1).endsWith("file.yml") ? "/mnt/c/workspace/file.yml\n" : "/mnt/c/workspace\n", "");
    if (args.includes("mktemp")) return callback(null, "/tmp/securepatch-scan-test123\n", "");
    if (args.includes("cp") || args.includes("rm")) return callback(null, "", "");
    callback(null, '{"results":[]}', "");
  });
  const windowsPath = "C:\\workspace\\file.yml";
  await expect(scanJSON("semgrep", ["--config", windowsPath], "C:\\workspace")).resolves.toMatchObject({ results: [] });
  const conversions = execFile.mock.calls.filter(([, args]) => args.includes("wslpath"));
  expect(conversions).toHaveLength(2);
  const scannerCall = execFile.mock.calls.find(([, args]) => args.includes("timeout"));
  expect(scannerCall[0]).toBe("wsl.exe");
  expect(scannerCall[1]).toEqual(["--distribution", "Ubuntu", "--cd", "/tmp/securepatch-scan-test123", "--exec", "timeout", "--signal=KILL", "120s",
    "/home/test/.local/share/securepatch-scanners/bin/semgrep", "--config", "/mnt/c/workspace/file.yml"]);
  expect(scannerCall[2]).toMatchObject({ cwd: "C:\\workspace", timeout: 120000 });
  expect(scannerCall[2].env).not.toHaveProperty("DATABASE_URL");
  await cleanupWslWorkspace("C:\\workspace");
  expect(execFile.mock.calls.at(-1)[1]).toEqual(["--distribution", "Ubuntu", "--exec", "rm", "-rf", "--", "/tmp/securepatch-scan-test123"]);
});
test.each(['{"results":[],"errors":[{"type":"fatal"}]}', 'not JSON', '{}'])("invalid scanner data fails closed", async stdout => {
  execFile.mockImplementation((binary, args, options, callback) => callback(null, stdout, ""));
  await expect(scanJSON("semgrep", [], "synthetic")).rejects.toThrow();
});
test("scanner subprocesses never inherit provider or database credentials", () => {
  expect(scannerEnv()).not.toHaveProperty("NVIDIA_API_KEY");
  expect(scannerEnv()).not.toHaveProperty("DATABASE_URL");
  expect(scannerEnv()).not.toHaveProperty("GITHUB_PRIVATE_KEY");
});

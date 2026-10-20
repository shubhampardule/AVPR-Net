jest.mock("node:child_process", () => ({ execFile: jest.fn() }));
const { execFile } = require("node:child_process");
const { scanJSON, scannerEnv } = require("../src/scanners/process");
beforeEach(() => jest.clearAllMocks());
test("fatal scanner exit is rejected even with valid JSON", async () => {
  execFile.mockImplementation((binary, args, options, callback) => callback(Object.assign(new Error("fatal"), { code: 2 }), '{"results":[]}', ""));
  await expect(scanJSON("semgrep", [], "synthetic")).rejects.toMatchObject({ code: "SCANNER_FAILED" });
});
test.each([0, 1])("scanner exit %s accepts valid findings with no analysis errors", async code => {
  execFile.mockImplementation((binary, args, options, callback) => callback(code ? { code } : null, '{"results":[],"errors":[]}', ""));
  await expect(scanJSON("semgrep", [], "synthetic")).resolves.toMatchObject({ results: [] });
  expect(execFile.mock.calls[0][2]).toMatchObject({ timeout: 120000, killSignal: "SIGKILL", windowsHide: true });
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

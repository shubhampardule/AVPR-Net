jest.mock("../src/scanners/process", () => ({ cleanupWslWorkspace: jest.fn().mockResolvedValue() }));
const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { validateManifest, downloadPinned, observations, summarizeTargets, runPilot } = require("../src/services/advisory-pilot.service");
const manifest = require("../fixtures/advisory-pilot.json");
const { cleanupWslWorkspace } = require("../src/scanners/process");
const copy = () => structuredClone(manifest);
const digest = value => createHash("sha256").update(value).digest("hex");

test("checked-in pilot pins every source revision and file hash", () => expect(() => validateManifest(manifest)).not.toThrow());
test.each([
  item => { item.cases[0].files[0].path = "../../escape.py"; },
  item => { item.cases[0].repository = "https://other.example/project"; },
  item => { item.cases[0].before = "main"; },
  item => { item.cases[0].files[0].beforeSha256 = "changed"; },
  item => { item.cases[0].rules = { arbitraryBinary: "rule" }; },
  item => { item.cases[0].files[0].targetLinesBefore = [0]; },
  item => { item.cases.push(item.cases[0]); },
])("rejects unsafe or unpinned pilot input", mutate => {
  const input = copy(); mutate(input);
  expect(() => validateManifest(input)).toThrow();
});
test("download verifies exact bytes and forbids redirects", async () => {
  const fetchImpl = jest.fn(async () => new Response("public source"));
  await expect(downloadPinned("https://raw.githubusercontent.com/pinned", digest("public source"), fetchImpl)).resolves.toEqual(Buffer.from("public source"));
  expect(fetchImpl.mock.calls[0][1]).toMatchObject({ redirect: "error", signal: expect.any(AbortSignal) });
  await expect(downloadPinned("url", digest("different"), fetchImpl)).rejects.toThrow("hash mismatch");
});
test.each([false, true])("download rejects oversized source with content length header=%s", async withHeader => {
  const response = new Response(Buffer.alloc(1024 * 1024 + 1), { headers: withHeader ? { "content-length": String(1024 * 1024 + 1) } : {} });
  await expect(downloadPinned("url", "unused", async () => response)).rejects.toThrow();
});
test("observations expose only bounded metadata and reject outside files", () => {
  const allowed = new Set(["repo/file.py"]);
  const raw = { check_id: "machine.path.securepatch.python.insecure-yaml", path: "repo/file.py", start: {line:2}, end:{line:4}, extra:{lines:"private code"} };
  expect(observations("semgrep", [raw], "/tmp/pilot", allowed)).toEqual([{scanner:"semgrep",rule:"securepatch.python.insecure-yaml",file:"repo/file.py",line:2,end:4}]);
  expect(() => observations("semgrep", [{...raw,path:"../outside.py"}], "/tmp/pilot", allowed)).toThrow();
});
test("target alerts use scanner, rule, path and line span; other alerts stay unadjudicated", () => {
  const file = "OISF/suricata-update/suricata/update/config.py";
  const findings = [
    {scanner:"semgrep",rule:"securepatch.python.insecure-yaml",file,line:135,end:136},
    {scanner:"semgrep",rule:"securepatch.python.insecure-yaml",file,line:20,end:20},
    {scanner:"bandit",rule:"B101",file,line:142,end:142},
  ];
  expect(summarizeTargets(manifest, "before", findings)[0]).toMatchObject({sitesWithAlert:1,otherAlerts:1,targetSites:4});
  expect(summarizeTargets(manifest, "before", findings)[1].sitesWithAlert).toBe(0);
});

function runtime({ failScan = false, incomplete = false } = {}) {
  const input = copy();
  input.cases = [input.cases[0]];
  input.cases[0].files = [input.cases[0].files[0]];
  input.cases[0].rules = { semgrep: "securepatch.python.insecure-yaml" };
  const content = "# static data; never imported\n";
  for (const revision of ["before", "after"]) input.cases[0].files[0][`${revision}Sha256`] = digest(content);
  const roots = [];
  return { roots, options: { manifest: input, fetchImpl: async () => new Response(content), adapterFactory: () => ({
    version: "test-double", isAvailable: async () => true,
    coverage:{scanned:incomplete ? 0 : 1,skipped:0,filesHash:digest(JSON.stringify(["OISF/suricata-update/suricata/update/config.py"]))},
    scan: async root => { roots.push(root); if (failScan) throw new Error("private details"); return []; },
  }) } };
}
afterEach(() => jest.clearAllMocks());
test("real temporary source cleanup runs after a successful pilot", async () => {
  const {roots,options} = runtime();
  const result = await runPilot(options);
  expect(result.datasetKind).toBe("advisory-pilot");
  expect(result.annotationStatus).toContain("not independently reviewed");
  expect(result.revisions.before.targets[0]).toMatchObject({sitesWithAlert:0,targetSites:2});
  expect(roots).toHaveLength(2);
  expect(cleanupWslWorkspace).toHaveBeenCalledTimes(2);
  await expect(fs.stat(path.dirname(roots[0]))).rejects.toMatchObject({code:"ENOENT"});
});
test.each([{failScan:true},{incomplete:true}])("scanner failure or partial coverage never produces a report and still cleans up", async flags => {
  const {roots,options} = runtime(flags);
  await expect(runPilot(options)).rejects.toThrow();
  expect(cleanupWslWorkspace).toHaveBeenCalledTimes(2);
  await expect(fs.stat(path.dirname(roots[0]))).rejects.toMatchObject({code:"ENOENT"});
});
test("missing required scanner prevents any downloads", async () => {
  const fetchImpl = jest.fn();
  await expect(runPilot({fetchImpl,adapterFactory:()=>({isAvailable:async()=>false})})).rejects.toThrow("unavailable");
  expect(fetchImpl).not.toHaveBeenCalled();
});
test("both WSL cleanup paths and host cleanup run when one WSL removal fails", async () => {
  const {roots,options} = runtime();
  cleanupWslWorkspace.mockRejectedValueOnce(new Error("WSL unavailable"));
  await expect(runPilot(options)).rejects.toThrow("cleanup incomplete");
  expect(cleanupWslWorkspace).toHaveBeenCalledTimes(2);
  await expect(fs.stat(path.dirname(roots[0]))).rejects.toMatchObject({code:"ENOENT"});
});
test("correct file count with a different covered file set is rejected", async () => {
  const {roots,options} = runtime();
  const factory = options.adapterFactory;
  options.adapterFactory = () => ({...factory(), coverage:{scanned:1,skipped:0,filesHash:digest(JSON.stringify(["unrelated.py"]))}});
  await expect(runPilot(options)).rejects.toThrow("coverage incomplete");
  await expect(fs.stat(path.dirname(roots[0]))).rejects.toMatchObject({code:"ENOENT"});
});

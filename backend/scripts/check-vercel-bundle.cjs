const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const expectedPolicy = require("../src/services/patch-rescan.service").policyHash();
const file = path.resolve(__dirname, "../src/app.vercel.cjs");
const source = fs.readFileSync(file, "utf8");
assert(!/require\(["']diff["']\)/.test(source), "Diff implementation must ship inside the API bundle");
const compiled = new Module(file, module);
compiled.filename = file;
compiled.paths = Module._nodeModulePaths(path.dirname(file));
// Test the actual generated factories, without modifying the deployment file.
compiled._compile(source + "\nmodule.exports.bundleCheck = { AssistantService: require_assistant_service().AssistantService, policyHash: require_patch_rescan_service().policyHash };", file);
const { AssistantService, policyHash } = compiled.exports.bundleCheck;
const readFile = fs.readFileSync;
try {
  fs.readFileSync = () => { throw new Error("Runtime source files unavailable"); };
  assert.equal(policyHash(), expectedPolicy, "API fingerprint must match the worker sources without reading runtime files");
} finally { fs.readFileSync = readFile; }
const originalCode = "function parseValue(value) {\n  return eval(value);\n}\nmodule.exports = { parseValue };\n";
const correctedCode = originalCode.replace("eval(value)", "JSON.parse(value)");
const provider = { chat: async () => ({ text: JSON.stringify({
  language: "javascript", format: "code", code: correctedCode,
  explanation: "Parse data instead of executing it.", assumptions: ["JSON input expected"],
  dependencies: [], security_considerations: ["Reject invalid JSON"],
  validation_instructions: ["Run regression tests"], tests: "Check valid and invalid JSON.", sources: [],
}) }) };
new AssistantService({ provider, rag: { retrieve: async () => ({ status: "ready", sources: [] }) } })
  .generateCode({ language: "javascript", mode: "review", request: "Replace eval with structured parsing.", originalCode, targetPath: "index.js" })
  .then(result => {
    assert.equal(result.status, "complete");
    assert(result.proposal.code.includes("+  return JSON.parse(value);"));
    console.log("Packaged proposal generation and source-independent scanner fingerprint passed");
  }).catch(error => { console.error(error); process.exitCode = 1; });

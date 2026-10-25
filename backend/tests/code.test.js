const { AssistantService } = require("../src/services/assistant.service");
const { validateCode } = require("../src/services/code-validation");

const snippets = { python: "def validate_port(value):\n    return value\n",
  javascript: "export const validatePort = value => value;",
  typescript: "export const validatePort = (value: unknown): number => Number(value);",
  c: "int validate_port(int v) { return v; }", cpp: "int validate_port(int v) { return v; }",
  bash: "is_valid_port() { return 0; }" };
function proposal(language) {
  return { language, format: "code", code: snippets[language], explanation: "Reviewable proposal",
    assumptions: ["Inputs need validation"], dependencies: [], security_considerations: ["Review edge cases"],
    validation_instructions: ["Independently test invalid values"], tests: "Test empty, invalid and boundary inputs.", sources: ["known"] };
}
function setup(language = "javascript", overrides = {}) {
  const provider = { chat: jest.fn(async () => ({ text: JSON.stringify(proposal(language)) })) };
  const rag = { retrieve: jest.fn(async () => ({ status: "ready", sources: [{ id: "known", source: "secure-coding.md" }] })) };
  const validator = jest.fn(async () => ({ status: "passed", executed: false }));
  return { provider, rag, validator, service: new AssistantService({ provider, rag, validator, ...overrides }) };
}

test("excerpt proposals map to real file lines and apply without changing surrounding source", async () => {
  const { service, provider } = setup();
  const before = "function parse(value) {\n  return eval(value);\n}\n";
  const after = before.replace("eval(value)", "JSON.parse(value)");
  provider.chat.mockResolvedValue({ text: JSON.stringify({ ...proposal("javascript"), code: after.trimEnd() }) });
  const result = await service.generateCode({ language: "javascript", mode: "review", request: "Replace eval with JSON parsing",
    originalCode: before, targetPath: "large.js", targetStartLine: 701 });
  expect(result.status).toBe("complete");
  const { parsePatch, applyPatch } = require("diff");
  expect(parsePatch(result.proposal.code)[0].hunks[0].oldStart).toBe(701);
  const prefix = "// unchanged preceding code\n".repeat(700);
  const suffix = "// unchanged following code\n".repeat(700);
  expect(applyPatch(prefix + before + suffix, result.proposal.code, { fuzzFactor: 0 })).toBe(prefix + after + suffix);
  expect(provider.chat.mock.calls[0][0][1].content).toContain("excerpt review");
});

test.each([0, -1, 1.5, "700", 1000001])("rejects invalid excerpt offsets %s before calling the model", async targetStartLine => {
  const { service, provider } = setup();
  await expect(service.generateCode({ language: "javascript", mode: "review", request: "Validate", originalCode: "const a = 1;", targetStartLine }))
    .rejects.toMatchObject({ code: "AI_INVALID_INPUT" });
  expect(provider.chat).not.toHaveBeenCalled();
});

test("short exact edits produce a source-bound diff without repeating the supplied excerpt", async () => {
  const { service, provider } = setup();
  const originalCode = "// context\nfunction parse(value) {\n  return eval(value);\n}\n// preserved\n";
  provider.chat.mockResolvedValue({ text: JSON.stringify({ ...proposal("javascript"), format: "edits",
    code: [{ before: "return eval(value);", after: "return JSON.parse(value);" }] }) });
  const result = await service.generateCode({ language: "javascript", mode: "review", request: "Use JSON parsing",
    originalCode, targetPath: "large.js", targetStartLine: 701 });
  expect(result.status).toBe("complete");
  const prefix = "// preceding\n".repeat(700);
  expect(require("diff").applyPatch(prefix + originalCode + "// following\n", result.proposal.code, { fuzzFactor: 0 }))
    .toBe(prefix + originalCode.replace("eval(value)", "JSON.parse(value)") + "// following\n");
});

test.each([
  [], [{ before: "missing", after: "value" }], [{ before: "value", after: "safe" }],
  [{ before: "return value;", after: "safe", extra: "not allowed" }],
  [{ before: "return value;", after: "return value;" }],
  [{ before: "return value;", after: "safe" }, { before: "value;", after: "safe" }],
].map(edits => ({ edits })))("invalid, ambiguous or overlapping model edits are rejected (%#)", async ({ edits }) => {
  const { service, provider } = setup();
  provider.chat.mockResolvedValue({ text: JSON.stringify({ ...proposal("javascript"), format: "edits", code: edits }) });
  const result = await service.generateCode({ language: "javascript", mode: "review", request: "Use safe parsing",
    originalCode: "function parse(value) { return value; }\n", targetPath: "large.js", targetStartLine: 701 });
  expect(result).toMatchObject({ status: "unavailable", proposal: null, error: { code: "AI_INVALID_OUTPUT" } });
});

test("runtime diagnostics name the failed stage without logging customer or exception text", async () => {
  const logger = { warn: jest.fn() };
  const { service, validator } = setup("javascript", { logger });
  validator.mockRejectedValue(new TypeError("private source and secret token"));
  const result = await service.generateCode({ language: "javascript", mode: "generate", request: "Validate input" });
  expect(result.status).toBe("unavailable");
  expect(JSON.parse(logger.warn.mock.calls[0][0])).toEqual({ service: "assistant", operation: "code", stage: "syntax_validation", category: "TypeError" });
  expect(logger.warn.mock.calls[0][0]).not.toMatch(/private|secret|Validate input/);
});

test.each(Object.keys(snippets))("shared code service supports %s without executing output", async (language) => {
  const { service, validator } = setup(language);
  const result = await service.generateCode({ language, mode: "generate", request: "Validate defensive input" });
  expect(result.status).toBe("complete");
  expect(result.proposal.code).toBe(snippets[language]);
  expect(result.applied).toBe(false);
  expect(result.tests_status).toBe("suggested_not_executed");
  expect(validator).toHaveBeenCalledWith(language, snippets[language], "code");
});

test("review requires a diff and source; no file is changed", async () => {
  const { service, provider } = setup();
  const request = { language: "javascript", mode: "review", request: "Review input validation", originalCode: "let x = 1;", targetPath: "input.js" };
  const generated = await service.generateCode(request);
  expect(generated.status).toBe("complete");
  expect(generated.proposal.code).toContain("--- a/input.js");
  provider.chat.mockResolvedValue({ text: JSON.stringify({ ...proposal("javascript"), format: "diff", code: "--- a/input.js\n+++ b/input.js\n@@ -1 +1 @@\n-let x = 1;\n+const x = 1;" }) });
  expect((await service.generateCode(request)).proposal.format).toBe("diff");
  await expect(service.generateCode({ ...request, originalCode: undefined })).rejects.toMatchObject({ code: "AI_INVALID_INPUT" });
});

test("review replacement source becomes a deterministic diff for the finding path", async () => {
  const { service, provider } = setup();
  provider.chat.mockResolvedValue({ text: JSON.stringify({ ...proposal("javascript"), code: "const x = 1;\n" }) });
  const result = await service.generateCode({ language: "javascript", mode: "review", request: "Review the selected source and preserve behavior.", targetPath: "src/main.js", originalCode: "let x = 1;\n" });
  expect(result.status).toBe("complete");
  expect(result.proposal.format).toBe("diff");
  expect(result.proposal.code).toContain("--- a/src/main.js");
  expect(require("diff").applyPatch("let x = 1;\n", result.proposal.code)).toBe("const x = 1;\n");
  expect(result.proposal.code).toContain("--- a/src/main.js");
});

test("review rejects a one-file patch whose path differs from the scanned target", async () => {
  const { service, provider, validator } = setup();
  provider.chat.mockResolvedValue({ text: JSON.stringify({ ...proposal("javascript"), format: "diff",
    code: "--- a/other.js\n+++ b/other.js\n@@ -1 +1 @@\n-let x = 1;\n+const x = 1;" }) });
  const result = await service.generateCode({ language: "javascript", mode: "review", targetPath: "src/main.js", request: "Review source", originalCode: "let x = 1;\n" });
  expect(result).toMatchObject({ status: "unavailable", proposal: null });
  expect(validator).not.toHaveBeenCalled();
});

test("configurable languages, bounds and unknown fields are enforced", async () => {
  const { service } = setup("javascript", { env: { AI_LANGUAGES: "javascript" } });
  await expect(service.generateCode({ language: "python", mode: "generate", request: "x" })).rejects.toMatchObject({ code: "AI_INVALID_INPUT" });
  await expect(service.generateCode({ language: "javascript", mode: "generate", request: "x", execute: true })).rejects.toMatchObject({ code: "AI_INVALID_INPUT" });
  await expect(service.generateCode({ language: "javascript", mode: "generate", request: "x".repeat(3001) })).rejects.toMatchObject({ code: "AI_INVALID_INPUT" });
  await expect(service.generateCode({ language: "javascript", mode: "review", request: "Review", originalCode: "let x = 1;", targetPath: "../other.js" })).rejects.toMatchObject({ code: "AI_INVALID_INPUT" });
});

test.each([
  "--- a/source\n+++ b/source\n@@ -1,7 +1,7 @@\n-let x = 1;\n+const x = 1;\n",
  "--- a/source\n+++ b/source\n@@ -1 +1 @@\n-let other = 1;\n+const other = 1;\n",
])("malformed or mismatched review patches are never offered as complete", async code => {
  const { service, provider, validator } = setup();
  provider.chat.mockResolvedValue({ text: JSON.stringify({ ...proposal("javascript"), format: "diff", code }) });
  const result = await service.generateCode({ language: "javascript", mode: "review", request: "Review source", originalCode: "let x = 1;\n" });
  expect(result).toMatchObject({ status: "unavailable", proposal: null });
  expect(provider.chat).toHaveBeenCalledTimes(2);
  expect(validator).not.toHaveBeenCalled();
});

test("malformed and hallucinated code citations fail safely", async () => {
  const { service, provider } = setup();
  const input = { language: "javascript", mode: "generate", request: "Validate a port" };
  provider.chat.mockResolvedValue({ text: JSON.stringify({ ...proposal("javascript"), sources: ["made-up"] }) });
  expect((await service.generateCode(input)).error.code).toBe("AI_INVALID_OUTPUT");
  provider.chat.mockRejectedValue(new Error("sensitive-body"));
  expect(JSON.stringify(await service.generateCode(input))).not.toContain("sensitive-body");
});

test("bounded test-procedure arrays from the live provider are accepted", async () => {
  const { service, provider } = setup();
  provider.chat.mockResolvedValue({ text: JSON.stringify({ ...proposal("javascript"), tests: ["Reject NaN", "Accept 443"] }) });
  expect((await service.generateCode({ language: "javascript", mode: "generate", request: "Validate a port" })).status).toBe("complete");
});

test("live single-item metadata strings normalize to bounded lists", async () => {
  const { service, provider } = setup("c");
  provider.chat.mockResolvedValue({ text: JSON.stringify({ ...proposal("c"), assumptions: "C11 input",
    dependencies: "Standard headers only", security_considerations: "Check overflow", validation_instructions: "Review boundaries" }) });
  const result = await service.generateCode({ language: "c", mode: "generate", request: "Validate a port" });
  expect(result.status).toBe("complete");
  expect(result.proposal.assumptions).toEqual(["C11 input"]);
});

test("nested metadata objects remain invalid", async () => {
  const { service, provider } = setup();
  provider.chat.mockResolvedValue({ text: JSON.stringify({ ...proposal("javascript"), assumptions: { execute: true } }) });
  expect((await service.generateCode({ language: "javascript", mode: "generate", request: "Validate a port" })).error.code).toBe("AI_INVALID_OUTPUT");
});

test("one malformed hosted response is retried without weakening validation", async () => {
  const { service, provider, validator } = setup();
  provider.chat.mockResolvedValueOnce({ text: "not JSON" });
  const result = await service.generateCode({ language: "javascript", mode: "generate", request: "Validate a port" });
  expect(result.status).toBe("complete");
  expect(provider.chat).toHaveBeenCalledTimes(2);
  expect(provider.chat.mock.calls[1][0][1].content).toContain("A previous response failed validation");
  expect(validator).toHaveBeenCalledTimes(1);
});

test("persistent invalid output is bounded to two attempts and never validated or applied", async () => {
  const { service, provider, validator } = setup();
  provider.chat.mockResolvedValue({ text: "not JSON" });
  const result = await service.generateCode({ language: "javascript", mode: "generate", request: "Validate a port" });
  expect(result).toMatchObject({ status: "unavailable", proposal: null, applied: false });
  expect(provider.chat).toHaveBeenCalledTimes(2);
  expect(validator).not.toHaveBeenCalled();
});

test.each(["javascript", "typescript"])("%s parser validates syntax but never runs the program", async (language) => {
  const result = await validateCode(language, "throw new Error('would execute if evaluated');");
  expect(result).toMatchObject({ status: "passed", executed: false });
  expect(await validateCode(language, "const = ;")).toMatchObject({ status: "failed", executed: false });
});

test("Python parser checks syntax without executing the proposal", async () => {
  const result = await validateCode("python", "raise RuntimeError('must not execute')\n");
  expect(result).toMatchObject({ status: "passed", method: "lezer-python", executed: false });
  const bad = await validateCode("python", "def broken(:\n");
  expect(bad).toMatchObject({ status: "failed", method: "lezer-python", executed: false });
});

test.each(["c", "cpp", "bash"])("%s has honest unavailable parser status", async (language) => {
  expect(await validateCode(language, snippets[language])).toMatchObject({ status: "unavailable", executed: false });
});

test("diff validation and oversize input do not execute or apply code", async () => {
  expect(await validateCode("javascript", "bad", "diff")).toMatchObject({ status: "unavailable", executed: false });
  expect(await validateCode("javascript", "x".repeat(256 * 1024 + 1))).toMatchObject({ status: "failed", executed: false });
});

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
  const request = { language: "javascript", mode: "review", request: "Review input validation", originalCode: "let x = 1;" };
  expect((await service.generateCode(request)).status).toBe("unavailable");
  provider.chat.mockResolvedValue({ text: JSON.stringify({ ...proposal("javascript"), format: "diff", code: "--- a/input.js\n+++ b/input.js\n@@ -1 +1 @@\n-let x = 1;\n+const x = 1;" }) });
  expect((await service.generateCode(request)).proposal.format).toBe("diff");
  await expect(service.generateCode({ ...request, originalCode: undefined })).rejects.toMatchObject({ code: "AI_INVALID_INPUT" });
});

test("configurable languages, bounds and unknown fields are enforced", async () => {
  const { service } = setup("javascript", { env: { AI_LANGUAGES: "javascript" } });
  await expect(service.generateCode({ language: "python", mode: "generate", request: "x" })).rejects.toMatchObject({ code: "AI_INVALID_INPUT" });
  await expect(service.generateCode({ language: "javascript", mode: "generate", request: "x", execute: true })).rejects.toMatchObject({ code: "AI_INVALID_INPUT" });
  await expect(service.generateCode({ language: "javascript", mode: "generate", request: "x".repeat(3001) })).rejects.toMatchObject({ code: "AI_INVALID_INPUT" });
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

test.each(["javascript", "typescript"])("%s parser validates syntax but never runs the program", async (language) => {
  const result = await validateCode(language, "throw new Error('would execute if evaluated');");
  expect(result).toMatchObject({ status: "passed", executed: false });
  expect(await validateCode(language, "const = ;")).toMatchObject({ status: "failed", executed: false });
});

test("Python parser never executes proposal and reports interpreter availability", async () => {
  const result = await validateCode("python", "raise RuntimeError('must not execute')\n");
  expect(["passed", "unavailable"]).toContain(result.status);
  expect(result.executed).toBe(false);
  const bad = await validateCode("python", "def broken(:\n");
  expect(["failed", "unavailable"]).toContain(bad.status);
});

test.each(["c", "cpp", "bash"])("%s has honest unavailable parser status", async (language) => {
  expect(await validateCode(language, snippets[language])).toMatchObject({ status: "unavailable", executed: false });
});

test("diff validation and oversize input do not execute or apply code", async () => {
  expect(await validateCode("javascript", "bad", "diff")).toMatchObject({ status: "unavailable", executed: false });
  expect(await validateCode("javascript", "x".repeat(32001))).toMatchObject({ status: "failed", executed: false });
});

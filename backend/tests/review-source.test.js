const { reviewSource, MAX_SOURCE_BYTES } = require("../src/utils/review-source");

test.each([1, 400, 1000])("large CRLF files retain exact source boundaries around line %s", startLine => {
  const lines = Array.from({ length: 1000 }, (_, i) => `# unchanged line ${i + 1}\r\n`);
  const value = reviewSource(lines.join(""), { startLine });
  expect(value.sourceWindow.startLine).toBeLessThanOrEqual(startLine);
  expect(value.sourceWindow.endLine).toBeGreaterThanOrEqual(startLine);
  expect(value.originalCode).toBe(lines.slice(value.sourceWindow.startLine - 1, value.sourceWindow.endLine).join(""));
  expect(value.originalCode.endsWith("\r\n")).toBe(true);
});

test("Unicode and escaped source stays inside the model request budget", () => {
  const value = reviewSource(('# "你好世界" \\\n').repeat(1000), { startLine: 500 });
  expect(Buffer.byteLength(JSON.stringify(value.originalCode))).toBeLessThanOrEqual(4002);
  expect(value.sourceWindow.startLine).toBeLessThanOrEqual(500);
  expect(value.sourceWindow.endLine).toBeGreaterThanOrEqual(500);
});

test("oversize files fail with an actionable source error", () => {
  expect(() => reviewSource("x".repeat(MAX_SOURCE_BYTES + 1), { startLine: 1 })).toThrow("256 KB review limit");
});

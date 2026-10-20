jest.mock("node:fs/promises", () => ({ readdir: jest.fn(), stat: jest.fn(), readFile: jest.fn() }));
const fs = require("node:fs/promises");
const { SecretsAdapter, DependencyAdapter } = require("../src/scanners/repository-data.adapter");
beforeEach(() => {
  jest.clearAllMocks(); fs.stat.mockResolvedValue({ size: 100 });
  fs.readdir.mockResolvedValue([{ name: "test.js", isSymbolicLink: () => false, isDirectory: () => false, isFile: () => true }]);
});
test("credential values are omitted from stored findings", async () => {
  const token = "nvapi-" + "x".repeat(40); fs.readFile.mockResolvedValue(`const token = '${token}';`);
  const result = await new SecretsAdapter().scan("/synthetic");
  expect(result).toHaveLength(1); expect(JSON.stringify(result)).not.toContain(token);
});
test("dependency checks are explicit and describe advisory matches without invented severity", async () => {
  fs.readdir.mockResolvedValue([{ name: "package-lock.json", isSymbolicLink: () => false, isDirectory: () => false, isFile: () => true }]);
  fs.readFile.mockResolvedValue(JSON.stringify({ lockfileVersion: 3, packages: { "node_modules/example": { version: "1.0.0" } } }));
  const fetch = jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ results: [{ vulns: [{ id: "GHSA-example" }] }] })));
  try {
    const results = await new DependencyAdapter().scan("/synthetic");
    expect(results[0].description).toContain("Severity is unassessed");
    expect(JSON.parse(fetch.mock.calls[0][1].body).queries[0].package).toEqual({ ecosystem: "npm", name: "example" });
  } finally { fetch.mockRestore(); }
});

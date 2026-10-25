const path = require("node:path");
const { validateCode } = require("../src/services/code-validation");

test("JavaScript syntax validation locates its worker when launched outside backend cwd", async () => {
  const originalCwd = process.cwd();
  process.chdir(path.resolve(__dirname, "../.."));
  try {
    await expect(validateCode("javascript", "const answer = 42;"))
      .resolves.toMatchObject({ status: "passed", method: "babel-parser", executed: false });
  } finally {
    process.chdir(originalCwd);
  }
});

test("Python syntax validation uses the bundled parser when launched outside backend cwd", async () => {
  const originalCwd = process.cwd();
  process.chdir(path.resolve(__dirname, "../.."));
  try {
    await expect(validateCode("python", "def answer():\n    return 42\n"))
      .resolves.toMatchObject({ status: "passed", method: "lezer-python", executed: false });
    await expect(validateCode("python", "def broken(:\n"))
      .resolves.toMatchObject({ status: "failed", method: "lezer-python", executed: false });
    const malformedPatch = "def parse(xml):\n    defusedxml.defuse_stdlib()\n        return defusedxml.fromstring(xml)\n    except ElementTree.ParseError as exc:\n        raise ValueError() from exc\n";
    await expect(validateCode("python", malformedPatch))
      .resolves.toMatchObject({ status: "failed", method: "lezer-python", executed: false });
  } finally {
    process.chdir(originalCwd);
  }
});

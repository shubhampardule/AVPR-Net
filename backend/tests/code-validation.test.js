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

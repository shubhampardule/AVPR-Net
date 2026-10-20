const safeReturnTo = require("../src/utils/safeReturnTo");
const { googleCallback } = require("../src/controllers/auth.controller");

test.each([
  ["/invite/accept?token=abc", "/invite/accept?token=abc"],
  ["/dashboard", "/dashboard"],
  ["https://attacker.example", null],
  ["//attacker.example", null],
  ["/\\attacker.example", null],
  ["javascript:alert(1)", null],
  [null, null],
])("validates OAuth return path %p", (value, expected) => {
  expect(safeReturnTo(value)).toBe(expected);
});

test("Google sign-in returns to a stored safe invitation route and consumes it", () => {
  const original = process.env.FRONTEND_URL;
  process.env.FRONTEND_URL = "https://securepatch.example";
  const req = { session: { authReturnTo: "/invite/accept?token=abc" } };
  const res = { redirect: jest.fn() };
  googleCallback(req, res);
  expect(res.redirect).toHaveBeenCalledWith("https://securepatch.example/invite/accept?token=abc");
  expect(req.session.authReturnTo).toBeUndefined();
  if (original === undefined) delete process.env.FRONTEND_URL;
  else process.env.FRONTEND_URL = original;
});

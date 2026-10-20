const { optionalCommitSha } = require("../src/utils/input");

test("optional commit SHA accepts only a lowercase full SHA when supplied", () => {
  const sha = "a".repeat(40);
  expect(optionalCommitSha(undefined)).toBeUndefined();
  expect(optionalCommitSha(sha)).toBe(sha);
  for (const value of ["main", "A".repeat(40), "a".repeat(39), [sha], { sha }]) {
    expect(() => optionalCommitSha(value)).toThrow("Invalid commit SHA");
  }
});

const mongoose = require("mongoose");
const { main, assertDisposableDatabase } = require("../src/cli/lifecycle-acceptance");

test("the destructive cleanup guard accepts only the exact disposable namespace", () => {
  const databaseName = `avpr_acceptance_${"a".repeat(20)}`;
  expect(Buffer.byteLength(databaseName)).toBeLessThanOrEqual(38);
  expect(() => assertDisposableDatabase(databaseName, { db: { databaseName } })).not.toThrow();
  expect(() => assertDisposableDatabase(databaseName, { db: { databaseName: "project" } })).toThrow();
  expect(() => assertDisposableDatabase("project", { db: { databaseName: "project" } })).toThrow();
  expect(() => assertDisposableDatabase(`${databaseName}-extra`, { db: { databaseName: `${databaseName}-extra` } })).toThrow();
});

test("live acceptance refuses to connect without its disposable flag", async () => {
  const originalArgv = process.argv;
  const connect = jest.spyOn(mongoose, "connect");
  try {
    process.argv = ["node", "lifecycle-acceptance.js"];
    await expect(main()).rejects.toThrow("Run with --disposable");
    expect(connect).not.toHaveBeenCalled();
  } finally {
    process.argv = originalArgv;
    connect.mockRestore();
  }
});

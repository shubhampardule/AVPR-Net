jest.mock("mongoose", () => ({ connection: { readyState: 0 }, connect: jest.fn() }));
jest.mock("../src/config/env", () => ({ databaseUrl: "mongodb://unit-test/database" }));
const mongoose = require("mongoose");
const connectDatabase = require("../src/config/database");

beforeEach(() => { mongoose.connection.readyState = 0; mongoose.connect.mockReset(); });

test("concurrent requests share a single in-flight connection", async () => {
  let finish;
  mongoose.connect.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const first = connectDatabase();
  const second = connectDatabase();
  expect(mongoose.connect).toHaveBeenCalledTimes(1);
  mongoose.connection.readyState = 1;
  finish();
  await Promise.all([first, second]);
});

test("a warm instance reconnects after the previous connection closes", async () => {
  mongoose.connect.mockImplementation(async () => { mongoose.connection.readyState = 1; });
  await connectDatabase();
  mongoose.connection.readyState = 0;
  await connectDatabase();
  expect(mongoose.connect).toHaveBeenCalledTimes(2);
  expect(mongoose.connection.readyState).toBe(1);
});

test("failed connections can be retried", async () => {
  mongoose.connect.mockRejectedValueOnce(new Error("temporary outage"))
    .mockImplementationOnce(async () => { mongoose.connection.readyState = 1; });
  await expect(connectDatabase()).rejects.toThrow("temporary outage");
  await expect(connectDatabase()).resolves.toEqual(mongoose.connection);
  expect(mongoose.connect).toHaveBeenCalledTimes(2);
});

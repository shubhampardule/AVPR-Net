jest.mock("../src/config/github", () => require("./__mocks__/github"));
jest.mock("../src/queues/scanQueue", () => ({ scanQueue: {} }));
const crypto = require("node:crypto");
const { verifySignature, nextRun } = require("../src/services/automation.service");
test("webhook signature verifies exact raw bytes and rejects altered bodies", () => {
  const body = Buffer.from('{"event":"test"}'), secret = "synthetic";
  const signature = `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
  expect(verifySignature(body, signature, secret)).toBe(true);
  expect(verifySignature(Buffer.from("{}"), signature, secret)).toBe(false);
  expect(verifySignature(body, signature, "")).toBe(false);
  expect(verifySignature(body, "short", secret)).toBe(false);
});
test("monthly schedules clamp month ends without skipping February", () => {
  expect(nextRun("monthly", new Date("2027-01-31T12:00:00Z")).toISOString()).toBe("2027-02-28T12:00:00.000Z");
  expect(nextRun("weekly", new Date("2026-10-20T12:00:00Z")).toISOString()).toBe("2026-10-27T12:00:00.000Z");
  expect(nextRun("off")).toBeNull();
});

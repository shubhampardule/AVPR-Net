jest.mock("../src/config/logger", () => ({ info: jest.fn(), error: jest.fn() }));
const express = require("express");
const request = require("supertest");
const logger = require("../src/config/logger");
const { redact, sanitize } = require("../src/services/ai-safety");
const { createAssistantRouter } = require("../src/routes/assistant.routes");

test("malformed and oversized JSON never echo or log raw content", async () => {
  const app = express();
  app.use(express.json({ limit: "1kb" }));
  app.post("/input", (req, res) => res.json({ ok: true }));
  app.use(require("../src/middleware/errorHandler"));
  const broken = await request(app).post("/input").set("Content-Type", "application/json").send('{"password":"private-123",');
  expect(broken.status).toBe(400);
  expect(broken.body.error.code).toBe("INVALID_JSON");
  const large = await request(app).post("/input").send({ secret: "private-123".repeat(200) });
  expect(large.status).toBe(413);
  expect(JSON.stringify([broken.body, large.body, logger.error.mock.calls])).not.toContain("private-123");
});

test("HTTP logging excludes sensitive query strings", async () => {
  const app = express();
  app.use(require("../src/middleware/httpLogger"));
  app.get("/health", (req, res) => res.json({ ok: true }));
  await request(app).get("/health?api_key=private-123");
  expect(JSON.stringify(logger.info.mock.calls)).not.toContain("private-123");
});

test.each([
  ['api_key="private-123"', "private-123"], ["password = 'private-123'", "private-123"],
  ["Bearer private-123", "private-123"], ["nvapi-private123", "nvapi-private123"],
  ["https://user:private-123@example.org/path", "private-123"],
  ["person@example.org", "person@example.org"],
])("representative sensitive text is minimized case %#", (text, secret) => {
  expect(redact(text)).not.toContain(secret);
});

test("structured sensitive fields redact and unbounded nesting rejects", () => {
  expect(sanitize({ apiKey: "private-123", cookie: "session=private", values: ["Bearer private-token"] }))
    .toEqual({ apiKey: "[REDACTED]", cookie: "[REDACTED]", values: ["Bearer [REDACTED]"] });
  let value = "x";
  for (let i = 0; i < 12; i++) value = { child: value };
  expect(() => sanitize(value)).toThrow("nesting");
});

test("concurrency guard refuses a third active hosted request", async () => {
  const pending = [];
  const service = { languages: () => ["javascript"], generateCode: () => new Promise((resolve) => pending.push(resolve)) };
  const app = express(); app.use(express.json());
  app.use("/ai", createAssistantRouter({ demo: true, service, provider: {}, rag: {} }));
  const send = () => request(app).post("/ai/code").set("X-SecurePatch-Demo", "1")
    .set("X-SecurePatch-AI-Consent", "1").send({}).then((r) => r.status);
  const one = send(), two = send();
  const deadline = Date.now() + 1000;
  while (pending.length < 2 && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 5));
  expect(pending.length).toBe(2);
  expect(await send()).toBe(429);
  pending.forEach((resolve) => resolve({ status: "complete" }));
  expect(await Promise.all([one, two])).toEqual([200, 200]);
});

const express = require("express");
const request = require("supertest");
const { createAssistantRouter } = require("../src/routes/assistant.routes");
const event = require("../fixtures/events/suspicious.json");
let service, rag, provider;
beforeEach(() => {
  service = { languages: () => ["javascript"], analyzeEvent: jest.fn(async (e) => ({ status: "complete", original: e })),
    analyzeFinding: jest.fn(async (f) => ({ status: "complete", original: f })),
    generateCode: jest.fn(async () => ({ status: "complete", applied: false })) };
  rag = { diagnostics: async () => ({ chunks: 8 }), retrieve: async () => ({ status: "empty", sources: [] }) };
  provider = { health: () => ({ configured: true, reachable: null }) };
});
function app(options = {}) {
  const instance = express(); instance.use(express.json({ limit: "24kb" }));
  instance.use("/org/:organizationId/ai", createAssistantRouter({ service, rag, provider, ...options }));
  return instance;
}
const auth = (req, res, next) => { req.user = { _id: "user-1", status: "active" }; next(); };
const member = (req, res, next) => next();

test("production accepts the configured site origin while rejecting other origins", async () => {
  const saved = process.env.FRONTEND_URL;
  process.env.FRONTEND_URL = "https://avpr-psi.vercel.app";
  try {
    const instance = app({ requireAuth: auth, requireMembership: member });
    const accepted = await request(instance).post("/org/org-1/ai/analyze")
      .set("Origin", "https://avpr-psi.vercel.app").send({ event });
    expect(accepted.status).toBe(200);
    const rejected = await request(instance).post("/org/org-1/ai/analyze")
      .set("Origin", "https://evil.example").send({ event });
    expect(rejected.status).toBe(403);
    expect(service.analyzeEvent).toHaveBeenCalledTimes(1);
  } finally {
    if (saved === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = saved;
  }
});

test("production routes require authentication before any AI call", async () => {
  const response = await request(app()).post("/org/org-1/ai/code").send({});
  expect(response.status).toBe(401); expect(service.generateCode).not.toHaveBeenCalled();
});
test("membership failure denies access", async () => {
  const response = await request(app({ requireAuth: auth, requireMembership: (req, res) => res.sendStatus(403) }))
    .post("/org/org-1/ai/analyze").send({ event });
  expect(response.status).toBe(403); expect(service.analyzeEvent).not.toHaveBeenCalled();
});
test("persisted finding query is scoped to organization and cannot trust caller score", async () => {
  const findFinding = jest.fn(async () => ({ scanner: "bandit", riskScore: 7.35 }));
  const instance = app({ requireAuth: auth, requireMembership: member, findFinding });
  const id = "0123456789abcdef01234567";
  expect((await request(instance).post("/org/org-1/ai/analyze").send({ findingId: id })).status).toBe(200);
  expect(findFinding).toHaveBeenCalledWith({ _id: id, organization: "org-1" });
  expect((await request(instance).post("/org/org-1/ai/analyze").send({ findingId: id, riskScore: 1 })).status).toBe(400);
});
test("finding from another tenant is unavailable", async () => {
  const instance = app({ requireAuth: auth, requireMembership: member, findFinding: async () => null });
  expect((await request(instance).post("/org/other/ai/analyze").send({ findingId: "0123456789abcdef01234567" })).status).toBe(404);
});
test("demo requires explicit header and approved origin", async () => {
  const instance = app({ demo: true });
  expect((await request(instance).get("/org/demo/ai/health")).status).toBe(403);
  expect((await request(instance).get("/org/demo/ai/health").set("X-SecurePatch-Demo", "1")).status).toBe(200);
  expect((await request(instance).get("/org/demo/ai/health").set("X-SecurePatch-Demo", "1").set("Origin", "https://evil.example")).status).toBe(403);
});
test("demo rejects real events and all persisted findings", async () => {
  const instance = app({ demo: true });
  for (const input of [{ event: { ...event, synthetic: false } }, { findingId: "0123456789abcdef01234567" }]) {
    expect((await request(instance).post("/org/demo/ai/analyze").set("X-SecurePatch-Demo", "1").send(input)).status).toBe(400);
  }
  expect(service.analyzeEvent).not.toHaveBeenCalled();
});
test("normal demo event and knowledge workflows share services", async () => {
  const instance = app({ demo: true });
  const result = await request(instance).post("/org/demo/ai/analyze").set("X-SecurePatch-Demo", "1").send({ event });
  expect(result.body.data.original).toEqual(event);
  expect((await request(instance).get("/org/demo/ai/fixtures").set("X-SecurePatch-Demo", "1")).body.data.events.benign.synthetic).toBe(true);
});
test("provider unavailable retains original evidence with 503", async () => {
  service.analyzeEvent.mockResolvedValue({ status: "unavailable", original: event, analysis: null });
  const result = await request(app({ demo: true })).post("/org/demo/ai/analyze").set("X-SecurePatch-Demo", "1").send({ event });
  expect(result.status).toBe(503); expect(result.body.data.original).toEqual(event);
});
test("request rate limit bounds hosted costs", async () => {
  const instance = app({ demo: true });
  for (let i = 0; i < 10; i++) {
    expect((await request(instance).post("/org/demo/ai/code").set("X-SecurePatch-Demo", "1").send({})).status).toBe(200);
  }
  expect((await request(instance).post("/org/demo/ai/code").set("X-SecurePatch-Demo", "1").send({})).status).toBe(429);
  expect(service.generateCode).toHaveBeenCalledTimes(10);
});
test("demo server uses existing app without DB, OAuth, GitHub or scan routes", async () => {
  const saved = process.env.SECUREPATCH_DEMO_MODE;
  try {
    process.env.SECUREPATCH_DEMO_MODE = "true";
    const existingApp = require("../src/app");
    expect((await request(existingApp).get("/api/v1/health")).status).toBe(200);
    expect((await request(existingApp).get("/api/v1/ai/demo/health").set("X-SecurePatch-Demo", "1")).status).toBe(200);
    expect((await request(existingApp).get("/api/v1/scans/123")).status).toBe(404);
  } finally {
    if (saved === undefined) delete process.env.SECUREPATCH_DEMO_MODE;
    else process.env.SECUREPATCH_DEMO_MODE = saved;
  }
});

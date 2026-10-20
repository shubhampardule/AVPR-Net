const express = require("express");
const { NvidiaService } = require("../services/nvidia.service");
const { RagService } = require("../services/rag.service");
const { AssistantService, badInput } = require("../services/assistant.service");

function createAssistantRouter(options = {}) {
  const { demo = false } = options;
  const provider = options.provider || new NvidiaService({ logger: require("../config/logger") });
  const rag = options.rag || new RagService({ provider });
  const service = options.service || new AssistantService({ provider, rag });
  const router = express.Router({ mergeParams: true });
  const origins = new Set(["http://localhost:5174", "http://127.0.0.1:5174"]);
  if (!demo && process.env.FRONTEND_URL) origins.add(new URL(process.env.FRONTEND_URL).origin);
  const counters = new Map();
  let inFlight = 0;

  if (demo) {
    router.use((req, res, next) => {
      const address = req.socket.remoteAddress;
      if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address) ||
        req.get("X-SecurePatch-Demo") !== "1" ||
        (req.get("Origin") && !origins.has(req.get("Origin")))) {
        return res.status(403).json({ success: false, error: { code: "DEMO_ACCESS_DENIED", message: "Local demo access required" } });
      }
      next();
    });
  } else {
    router.use(options.requireAuth || require("../middleware/auth.middleware").requireAuth);
    router.use(options.requireMembership || require("../middleware/organization.middleware").requireOrganizationMember);
  }

  router.use((req, res, next) => {
    if (req.method === "POST" && (!req.is("application/json") ||
      (req.get("Origin") && !origins.has(req.get("Origin"))))) {
      return res.status(403).json({ success: false, error: { code: "AI_REQUEST_REJECTED", message: "Use JSON from an approved application origin" } });
    }
    next();
  });

  const handle = (fn, costly = false) => async (req, res) => {
    let acquired = false;
    let release = null;
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), 210000);
    const disconnected = () => { if (!res.writableEnded) controller.abort(); };
    res.once("close", disconnected);
    try {
      if (costly) {
        if (!demo) {
          const budget = options.budget || require("../services/budget.service");
          await budget.consume(`ai-user:${req.user._id}`, 10, 60000);
          await budget.consume(`ai-org:${req.params.organizationId}`, 100, 3600000);
          release = await budget.reserveSlots(`ai-concurrent:${req.user._id}`);
        }
        const now = Date.now();
        for (const [key, value] of counters) if (value.until < now) counters.delete(key);
        const key = demo ? "local-demo" : String(req.user._id);
        const counter = counters.get(key) || { count: 0, until: now + 60000 };
        if (counter.count >= 10 || counters.size > 1000 || inFlight >= 2) {
          return res.status(429).json({ success: false, error: { code: "AI_BUSY", message: "Assistant request limit reached; retry later" } });
        }
        counter.count++; counters.set(key, counter); inFlight++; acquired = true;
      }
      const result = await require("../services/ai-context").run({ signal: controller.signal }, () => fn(req));
      res.status(result.status === "unavailable" ? 503 : 200).json({ success: result.status !== "unavailable", data: result });
    } catch (error) {
      const inputError = error.code === "AI_INVALID_INPUT" || error.code === "RAG_INVALID_QUERY";
      res.status(error.statusCode || (inputError ? 400 : 503)).json({ success: false,
        error: { code: inputError ? error.code : "AI_UNAVAILABLE",
          message: inputError ? error.message : "Assistant unavailable; check configuration and knowledge index" } });
    } finally {
      clearTimeout(deadline); res.off("close", disconnected);
      if (release) await release().catch(() => {});
      if (acquired) inFlight--;
    }
  };

  router.get("/health", handle(async () => ({ ...provider.health(), demo,
    languages: service.languages(), execution: "disabled" })));
  router.get("/knowledge", handle(async () => rag.diagnostics()));
  if (!demo) router.get("/finding/:findingId", handle(async req => {
    const { objectId, bad } = require("../utils/input");
    objectId(req.params.findingId);
    const finding = await require("../models/Finding").findOne({ _id: req.params.findingId, organization: req.params.organizationId }).lean();
    if (!finding) throw bad("Finding not found", 404);
    const scan = await require("../models/Scan").findById(finding.scan).lean();
    return require("../services/remediation.service").source(scan, finding);
  }));
  router.get("/fixtures", handle(async () => ({
    events: { suspicious: require("../../fixtures/events/suspicious.json"), benign: require("../../fixtures/events/benign.json") },
    code: Object.fromEntries(["python", "javascript", "typescript", "c", "cpp", "bash", "review"]
      .map((name) => [name, require(`../../fixtures/code/${name}.json`)])),
    provenance: "Project-authored synthetic fixtures; no production telemetry",
  })));
  router.post("/retrieve", handle(async (req) => {
    if (!req.body || Object.keys(req.body).some((k) => k !== "query")) throw badInput("Provide only a query");
    return rag.retrieve(req.body.query);
  }, true));
  router.post("/analyze", handle(async (req) => {
    if (!req.body || Object.keys(req.body).length !== 1) throw badInput("Provide an event or a findingId");
    if (req.body.event) {
      if (demo && req.body.event.synthetic !== true) throw badInput("Demo mode accepts synthetic events only");
      return service.analyzeEvent(req.body.event);
    }
    if (demo || typeof req.body.findingId !== "string" || !/^[a-f0-9]{24}$/i.test(req.body.findingId)) {
      throw badInput("Provide an authorized finding ID or supported event");
    }
    const findFinding = options.findFinding || ((filter) => require("../models/Finding").findOne(filter).lean());
    const finding = await findFinding({ _id: req.body.findingId, organization: req.params.organizationId });
    if (!finding) throw Object.assign(badInput("Finding unavailable for this organization"), { statusCode: 404 });
    if (options.findFinding) return service.analyzeFinding(finding);
    const index = await rag.read();
    const key = require("node:crypto").createHash("sha256").update(JSON.stringify({
      organization: req.params.organizationId, finding, model: provider.health().chatModel,
      corpus: index?.updatedAt, prompt: "finding-v2",
    })).digest("hex");
    const Cache = require("../models/AssistantCache");
    const cached = await Cache.findOne({ _id: key, expires: { $gt: new Date() } }).lean();
    if (cached) return { ...cached.result, cached: true };
    const result = await service.analyzeFinding(finding);
    if (result.status === "complete") await Cache.updateOne({ _id: key }, { $set: { result, expires: new Date(Date.now() + 600000) } }, { upsert: true }).catch(() => {});
    return result;
  }, true));
  router.post("/code", handle(async (req) => service.generateCode(req.body), true));
  return router;
}

module.exports = { createAssistantRouter };

require("dotenv").config({ quiet: true });
const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { NvidiaService } = require("../services/nvidia.service");
const { RagService } = require("../services/rag.service");
const { AssistantService } = require("../services/assistant.service");
const { getNvidiaConfig } = require("../config/nvidia");
const cases = require("../../fixtures/retrieval.json");
const approved = require("../../knowledge/sources.json");
const languages = ["python", "javascript", "typescript", "c", "cpp", "bash", "review"];
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

function mockProvider() {
  // Deterministic integration doubles; these are NOT NVIDIA quality measurements.
  const vector = (s) => [
    (s.match(/SSH|authentication|login|monitoring|health check/gi) || []).length,
    (s.match(/Python|JavaScript|TypeScript|buffer|subprocess|C\+\+|Bash|coding/gi) || []).length,
    (s.match(/risk|severity|exploitability|occurrence|business impact/gi) || []).length,
    0.1,
  ];
  const snippets = { python: "def validate_port(value):\n    return isinstance(value, int) and not isinstance(value, bool) and 1 <= value <= 65535\n",
    javascript: "export function validatePort(value) { return Number.isInteger(value) && value >= 1 && value <= 65535; }",
    typescript: "export function validatePort(value: unknown): boolean { return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 65535; }",
    c: "int validate_port(unsigned int n) { return n >= 1 && n <= 65535; }",
    cpp: "bool validate_port(unsigned int n) { return n >= 1 && n <= 65535; }",
    bash: "is_valid_port() { [[ $1 =~ ^[0-9]+$ ]] && (( ${#1} <= 5 )) && (( 10#$1 >= 1 && 10#$1 <= 65535 )); }" };
  return {
    embed: async (texts) => ({ vectors: texts.map(vector), model: "nvidia/nemotron-3-embed-1b", dimensions: 4 }),
    chat: async (messages) => {
      const input = JSON.parse(messages[1].content.split("UNTRUSTED_DATA_JSON:\n")[1]);
      const sources = input.retrieved_context.slice(0, 1).map((c) => c.id);
      const result = input.request ? { language: input.request.language,
        format: input.request.mode === "review" ? "diff" : "code",
        code: input.request.mode === "review" ? "--- a/port.js\n+++ b/port.js\n@@ -1 +1 @@\n-export function validatePort(value) { return parseInt(value, 10); }\n+export function validatePort(value) { return Number.isInteger(value) && value >= 1 && value <= 65535; }"
          : snippets[input.request.language], explanation: "Deterministic mock proposal, not a live model result.",
        assumptions: ["Synthetic fixture"], dependencies: [], security_considerations: ["Human review required"],
        validation_instructions: ["Check boundary cases independently"], tests: "Propose boundary tests; not executed.", sources }
        : { summary: "Synthetic event; independently validate surrounding logs.", severity_assessment: "unknown",
          observed_evidence: [JSON.stringify(input.evidence.original)], possible_interpretations: ["Expected automation or suspicious activity"],
          recommended_actions: ["Review authorized logs"], false_positive_checks: ["Check inventory"],
          missing_information: ["Surrounding telemetry"], sources, limitations: ["Mocked model, synthetic event"] };
      return { text: JSON.stringify(result), requestId: "mock-evaluation" };
    },
  };
}

async function main() {
  const live = process.argv.includes("--live");
  const folder = path.resolve(__dirname, "../../.local");
  await fs.mkdir(folder, { recursive: true });
  const operations = [];
  const env = live ? process.env : { NVIDIA_EMBEDDING_DIMENSIONS: "4" };
  const provider = live ? new NvidiaService({ logger: { info: (message) => operations.push(JSON.parse(message)) } }) : mockProvider();
  const rag = new RagService({ provider, env, indexPath: path.join(folder, live ? "knowledge.json" : "evaluation-mock-index.json") });
  const indexing = await rag.ingest(approved, { rebuild: !live });
  const index = await rag.read();
  const service = new AssistantService({ provider, rag });
  const report = { mode: live ? "live_nvidia" : "deterministic_mock", startedAt: new Date().toISOString(),
    environment: { node: process.version, platform: process.platform, architecture: process.arch },
    configuration: { ...rag.signature(), chatModel: live ? getNvidiaConfig().chatModel : "mock",
      ...(live ? { headerTimeoutMs: getNvidiaConfig().connectionTimeoutMs, bodyTimeoutMs: getNvidiaConfig().responseTimeoutMs,
        retries: getNvidiaConfig().retries, maxTokens: getNvidiaConfig().maxTokens } : {}) },
    corpus: { chunks: index.chunks.length, sources: [...new Set(index.chunks.map((c) => c.source))],
      contentHash: digest(index.chunks.map((c) => [c.source, c.contentHash])), indexing },
    retrieval: [], workflows: [], limitations: ["Small project-authored synthetic sample; not a representative benchmark.",
      "No detector accuracy, generated-code behavioral pass rate or production performance is measured.",
      "Citation validity checks ID membership, not whether the source substantively proves every claim.",
      "Syntax checks do not establish functional correctness or security; generated tests are never executed."] };
  const artifacts = [];
  for (const item of cases) {
    const started = Date.now();
    try {
      const result = await rag.retrieve(item.query, { k: 3 });
      report.retrieval.push({ id: item.id, hit: result.sources.some((s) => s.source === item.expected_source),
        expectedSource: item.expected_source, returnedSources: result.sources.map((s) => s.source),
        latencyMs: Date.now() - started });
    } catch (error) { report.retrieval.push({ id: item.id, hit: false, error: error.code || "UNAVAILABLE", latencyMs: Date.now() - started }); }
  }
  const tasks = [
    ...["suspicious", "benign"].map((name) => ({ id: `event-${name}`, kind: "event", input: require(`../../fixtures/events/${name}.json`) })),
    ...languages.map((name) => ({ id: `code-${name}`, kind: "code", input: require(`../../fixtures/code/${name}.json`) })),
  ];
  for (const task of tasks) {
    const started = Date.now();
    const result = task.kind === "event" ? await service.analyzeEvent(task.input) : await service.generateCode(task.input);
    const cited = (result.analysis || result.proposal)?.sources || [];
    const retrieved = result.retrieved_sources || [];
    report.workflows.push({ id: task.id, status: result.status, latencyMs: Date.now() - started,
      error: result.error?.code || null, structuredValid: result.status === "complete",
      citedCount: cited.length, citationIdsValid: cited.every((c) => retrieved.some((s) => s.id === c.id)),
      inputPreserved: task.kind === "event" ? JSON.stringify(result.original) === JSON.stringify(task.input) : null,
      syntax: result.validation?.status || null, parser: result.validation?.method || null,
      executed: false, proposedCodeHash: result.proposal ? digest(result.proposal.code) : null });
    artifacts.push({ id: task.id, input: task.input, result });
    console.log(`${task.id}: ${result.status} (${Date.now() - started} ms)`);
  }
  const successful = report.workflows.filter((r) => r.structuredValid);
  const parsed = report.workflows.filter((r) => ["passed", "failed"].includes(r.syntax));
  const cited = successful.reduce((n, r) => n + r.citedCount, 0);
  const durations = report.workflows.map((r) => r.latencyMs).sort((a, b) => a - b);
  report.metrics = {
    retrievalHitAt3: { hits: report.retrieval.filter((r) => r.hit).length, total: cases.length },
    structuredValidity: { valid: successful.length, total: tasks.length },
    citationIdValidity: { validResponses: successful.filter((r) => r.citationIdsValid).length, totalResponses: successful.length, citedIds: cited },
    syntax: { passed: parsed.filter((r) => r.syntax === "passed").length, checked: parsed.length,
      unavailable: report.workflows.filter((r) => r.syntax === "unavailable").length },
    generatedUnitTests: { executed: 0, passRate: null },
    logicalWorkflowErrorRate: report.workflows.filter((r) => r.status !== "complete").length / tasks.length,
    providerAttempts: operations.length, providerFailedAttempts: operations.filter((r) => r.status !== "ok").length,
    latencyMs: { median: durations[Math.floor(durations.length / 2)], max: durations.at(-1) },
  };
  report.completedAt = new Date().toISOString();
  const suffix = live ? "live" : "mock";
  const archive = path.join(folder, "evaluations", `${suffix}-${report.startedAt.replace(/[:.]/g, "-")}`);
  await fs.mkdir(archive, { recursive: true });
  await fs.writeFile(path.join(archive, "report.json"), JSON.stringify(report, null, 2), { mode: 0o600 });
  await fs.writeFile(path.join(archive, "artifacts.json"), JSON.stringify(artifacts, null, 2), { mode: 0o600 });
  await fs.writeFile(path.join(folder, `evaluation-${suffix}.json`), JSON.stringify(report, null, 2), { mode: 0o600 });
  await fs.writeFile(path.join(folder, `evaluation-${suffix}-artifacts.json`), JSON.stringify(artifacts, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(report.metrics, null, 2));
  if (successful.length !== tasks.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(JSON.stringify({ code: error.code || "EVALUATION_FAILED", message: "Evaluation failed; check provider and approved index configuration" }));
  process.exitCode = 1;
});

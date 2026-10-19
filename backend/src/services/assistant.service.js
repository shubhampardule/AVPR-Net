const { sanitize, SYSTEM_POLICY } = require("./ai-safety");
const { invalid, isText, isList, parseObject, resolveSources } = require("./ai-output");
const { validateCode } = require("./code-validation");
const ALL_LANGUAGES = ["python", "javascript", "typescript", "c", "cpp", "bash"];
const CODE_FIELDS = ["language", "format", "code", "explanation", "assumptions", "dependencies",
  "security_considerations", "validation_instructions", "tests", "sources"];

const badInput = (message) => Object.assign(new Error(message), { code: "AI_INVALID_INPUT", statusCode: 400 });
const bounded = (value, bytes = 16000) => {
  if (Buffer.byteLength(JSON.stringify(value) || "") > bytes) throw badInput("Input exceeds size limit");
};
const FIELDS = ["summary", "severity_assessment", "observed_evidence", "possible_interpretations",
  "recommended_actions", "false_positive_checks", "missing_information", "sources", "limitations"];
const LIST_FIELDS = FIELDS.filter((f) => !["summary", "severity_assessment", "sources"].includes(f));

function eventAdapter(event) {
  bounded(event);
  const allowed = ["id", "timestamp", "category", "synthetic", "protocol", "destination_port",
    "failed_attempts", "successful_logins", "connections", "bytes_out", "window_seconds", "description"];
  if (!event || Array.isArray(event) || typeof event !== "object" ||
    Object.keys(event).some((key) => !allowed.includes(key)) || !isText(event.id, 100) ||
    !isText(event.timestamp, 64) || !/^\d{4}-\d{2}-\d{2}T/.test(event.timestamp) ||
    !Number.isFinite(Date.parse(event.timestamp)) ||
    !["authentication", "service_check", "outbound_volume"].includes(event.category) ||
    typeof event.synthetic !== "boolean" ||
    (event.description !== undefined && !isText(event.description, 2000)) ||
    (event.protocol !== undefined && !["ssh", "https", "http", "tcp", "udp"].includes(event.protocol))) {
    throw badInput("Provide a supported event with id, ISO timestamp, category and synthetic flag");
  }
  for (const field of ["destination_port", "failed_attempts", "successful_logins", "connections", "bytes_out", "window_seconds"]) {
    if (event[field] !== undefined && (!Number.isSafeInteger(event[field]) || event[field] < 0 ||
      (field === "destination_port" && event[field] > 65535) || (field === "window_seconds" && event[field] === 0))) {
      throw badInput(`Invalid event field: ${field}`);
    }
  }
  const observations = ["failed_attempts", "successful_logins", "connections", "bytes_out"];
  if (!observations.some((f) => event[f] !== undefined)) throw badInput("Event needs at least one observed count");
  return { kind: event.synthetic ? "synthetic_event" : "user_supplied_event",
    original: { ...event }, detector: null };
}

function findingAdapter(finding) {
  const keys = ["_id", "scanner", "ruleId", "cwe", "filePath", "startLine", "endLine", "severity",
    "riskScore", "riskFactors", "riskCategory", "title", "description", "evidenceSnippet", "remediation"];
  if (!finding || !["semgrep", "bandit", "trivy"].includes(finding.scanner) || !isText(finding.ruleId) ||
    !Number.isFinite(finding.riskScore)) throw badInput("Finding must contain actual normalized scanner evidence");
  const original = Object.fromEntries(keys.filter((key) => finding[key] !== undefined)
    .map((key) => [key, key === "_id" ? String(finding[key]) : finding[key]]));
  bounded(original);
  return { kind: "repository_finding", original,
    detector: { scanner: finding.scanner, severity: finding.severity,
      riskScore: finding.riskScore, riskCategory: finding.riskCategory } };
}

class AssistantService {
  constructor({ provider, rag, validator = validateCode, env = process.env }) {
    this.provider = provider; this.rag = rag; this.validator = validator; this.env = env;
  }

  languages() {
    return (this.env.AI_LANGUAGES || ALL_LANGUAGES.join(",")).split(",")
      .map((s) => s.trim()).filter((s, i, all) => ALL_LANGUAGES.includes(s) && all.indexOf(s) === i);
  }

  async generateCode(input) {
    bounded(input);
    if (!input || typeof input !== "object" || Array.isArray(input) ||
      Object.keys(input).some((key) => !["request", "language", "mode", "originalCode"].includes(key)) ||
      !isText(input.request, 3000) || !this.languages().includes(input.language) ||
      !["generate", "review"].includes(input.mode) ||
      (input.originalCode !== undefined && !isText(input.originalCode, 8000)) ||
      (input.mode === "review" && !input.originalCode)) {
      throw badInput("Provide a bounded defensive request, supported language, mode and source for reviews");
    }
    const clean = sanitize(input);
    let retrieval;
    try {
      retrieval = await this.rag.retrieve(`${clean.language} secure coding guidance ${clean.request}`.slice(0, 1500),
        { minScore: 0.15 });
      const response = await this.provider.chat([
        { role: "system", content: SYSTEM_POLICY },
        { role: "user", content: `Produce a defensive implementation or remediation review in the requested language.
Keep the entire response concise, preferably under 1000 tokens; suggest at most five tests.
Return exactly these JSON keys: ${CODE_FIELDS.join(", ")}.
language must match the request. format is code or diff. For review mode return a
unified diff in code; for generate mode return standalone source code. code and tests
are plain strings (no markdown fences). explanation is a short string. assumptions,
dependencies, security_considerations, validation_instructions are arrays of short
strings, or one short string when there is only one item. tests is a plain string or array of short strings containing a focused suggested test or regression test procedure, never a
claim of test execution. Include expected inputs/outputs and compatibility limits.
sources is an array of IDs found in retrieved_context. Do not invent sources or
dependencies. UNTRUSTED_DATA_JSON:\n${JSON.stringify({ request: clean,
            retrieval_status: retrieval.status, retrieved_context: retrieval.sources })}` },
      ]);
      const proposal = parseObject(response.text, CODE_FIELDS);
      // Hosted responses sometimes encode a single textual item as a string.
      // Normalize only these known text-list fields; objects and oversized items still fail.
      for (const field of ["assumptions", "dependencies", "security_considerations", "validation_instructions"]) {
        if (typeof proposal[field] === "string" && proposal[field].length <= 2000) {
          proposal[field] = proposal[field].trim() ? [proposal[field]] : [];
        }
      }
      if (proposal.language !== input.language || !["code", "diff"].includes(proposal.format) ||
        (input.mode === "review" && proposal.format !== "diff") ||
        !isText(proposal.code, 18000) || !(isText(proposal.tests, 8000) || (isList(proposal.tests) && proposal.tests.length)) || !isText(proposal.explanation) ||
        ["assumptions", "dependencies", "security_considerations", "validation_instructions"].some((k) => !isList(proposal[k]))) {
        throw invalid();
      }
      if (proposal.format === "diff" && (!/^--- /m.test(proposal.code) || !/^\+\+\+ /m.test(proposal.code) || !/^@@ /m.test(proposal.code))) throw invalid();
      const sources = resolveSources(proposal.sources, retrieval.sources);
      const validation = await this.validator(input.language, proposal.code, proposal.format);
      return { status: "complete", advisory: true, language: input.language, mode: input.mode,
        proposal: { ...proposal, sources }, validation, requestId: response.requestId,
        retrieved_sources: retrieval.sources, retrieval_status: retrieval.status,
        tests_status: "suggested_not_executed", applied: false,
        limitations: ["Syntax validation does not establish correctness or security.",
          "Generated code and tests require independent review; no changes were applied.",
          ...(!retrieval.sources.length ? ["Retrieved context is insufficient; proposal is not source-grounded."] : [])] };
    } catch (error) {
      return { status: "unavailable", advisory: true, proposal: null, applied: false,
        retrieved_sources: retrieval?.sources || [],
        error: { code: /^(?:NVIDIA_|RAG_|AI_)/.test(error.code || "") ? error.code : "AI_UNAVAILABLE",
          message: "Code assistance could not be completed. No files were changed." } };
    }
  }

  async analyzeEvent(event) { return this.analyze(eventAdapter(event)); }
  async analyzeFinding(finding) { return this.analyze(findingAdapter(finding)); }

  async analyze(evidence) {
    let retrieval;
    const clean = sanitize(evidence);
    try {
      const query = evidence.kind === "repository_finding"
        ? `${clean.original.scanner} ${clean.original.cwe} ${clean.original.title}`
        : `${clean.original.category} ${clean.original.protocol || ""} ${clean.original.description || ""}`;
      retrieval = await this.rag.retrieve(query.slice(0, 1500));
      const context = retrieval.sources;
      const response = await this.provider.chat([
        { role: "system", content: SYSTEM_POLICY },
        { role: "user", content: `Analyze the following defensive evidence. Return exactly these JSON keys:
${FIELDS.join(", ")}. summary is a nonempty string; severity_assessment is one of
unknown, low, medium, high, critical (advisory only). All other fields are arrays
of short strings; sources contains only IDs from retrieved_context. Include at
least one limitation. Clearly acknowledge synthetic/manual event provenance and
lack of a network detector when applicable. Do not imply observed_evidence is
independently verified. UNTRUSTED_DATA_JSON:\n${JSON.stringify({ evidence: clean,
            retrieval_status: retrieval.status, retrieved_context: context })}` },
      ]);
      const analysis = parseObject(response.text, FIELDS);
      if (!isText(analysis.summary) || !["unknown", "low", "medium", "high", "critical"].includes(analysis.severity_assessment) ||
        LIST_FIELDS.some((f) => !isList(analysis[f])) || !analysis.limitations.length) throw invalid();
      const sources = resolveSources(analysis.sources, context);
      return { ...evidence, status: "complete", advisory: true,
        analysis: { ...analysis, sources }, retrieved_sources: context,
        retrieval_status: retrieval.status, requestId: response.requestId,
        limitations: ["AI advice is unverified; recommendations have not been executed.",
          ...(evidence.detector ? ["Original scanner risk is a prioritization score, not a probability."]
            : ["This is event analysis; this repository has no network detection engine."]),
          ...(!context.length ? ["Retrieved context is insufficient; no source-backed conclusion is available."] : [])] };
    } catch (error) {
      return { ...evidence, status: "unavailable", advisory: true, analysis: null,
        retrieved_sources: retrieval?.sources || [],
        error: { code: /^(?:NVIDIA_|RAG_|AI_)/.test(error.code || "") ? error.code : "AI_UNAVAILABLE",
          message: "AI-assisted analysis could not be completed. Original evidence is retained." },
        limitations: ["No AI conclusion is available. No response action was executed."] };
    }
  }
}

module.exports = { AssistantService, eventAdapter, findingAdapter, badInput, bounded };

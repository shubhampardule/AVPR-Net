const { randomUUID } = require("node:crypto");
const { getNvidiaConfig } = require("../config/nvidia");
const { defaultBudgetService } = require("./ai-budget.service");

class NvidiaError extends Error {
  constructor(code, message, requestId, status = null) {
    super(message);
    this.name = "NvidiaError";
    this.code = code;
    this.requestId = requestId;
    this.status = status;
  }
}

const invalid = (message) => new NvidiaError("NVIDIA_INVALID_INPUT", message);
const malformed = (requestId) => new NvidiaError(
  "NVIDIA_INVALID_RESPONSE", "NVIDIA returned an invalid or incomplete response", requestId
);

// All output is data. This provider has no tools or ability to execute generated code.
class NvidiaService {
  constructor({ env = process.env, fetchImpl = globalThis.fetch,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    logger = null, budgetService = defaultBudgetService } = {}) {
    this.env = env;
    this.fetch = fetchImpl;
    this.sleep = sleep;
    this.logger = logger;
    this.budgetService = budgetService;
  }

  health() {
    try {
      const config = getNvidiaConfig(this.env);
      return { configured: Boolean(config.apiKey), reachable: null,
        status: config.apiKey ? "configured_unverified" : "missing_key",
        provider: config.provider, providerName: config.providerName,
        chatModel: config.chatModel, embeddingModel: config.embeddingModel,
        embeddingDimensions: config.embeddingDimensions,
        budget: this.budgetService?.getUsage() };
    } catch (_) {
      return { configured: false, reachable: null, status: "invalid_configuration" };
    }
  }


  settings() {
    let config;
    try { config = getNvidiaConfig(this.env); }
    catch (_) { throw new NvidiaError("NVIDIA_CONFIGURATION", "NVIDIA configuration is invalid"); }
    if (!config.apiKey) {
      throw new NvidiaError("NVIDIA_NOT_CONFIGURED", "NVIDIA_API_KEY is not configured");
    }
    return config;
  }

  async request(endpoint, payload, config) {
    const requestId = randomUUID();
    const started = Date.now();
    for (let attempt = 0; attempt <= config.retries; attempt++) {
      const controller = new AbortController();
      const parentSignal = require("./ai-context").getStore()?.signal;
      const abort = () => controller.abort();
      if (parentSignal?.aborted) controller.abort();
      else parentSignal?.addEventListener("abort", abort, { once: true });
      let timer;
      // Non-streaming chat sends headers only after inference has completed.
      // Its first-byte wait belongs to the response budget, not a short connect budget.
      const inference = endpoint === "chat/completions";
      let phase = inference ? "response" : "connection";
      try {
        timer = setTimeout(() => controller.abort(), inference ? config.responseTimeoutMs : config.connectionTimeoutMs);
        const response = await this.fetch(`${config.baseUrl}/${endpoint}`, {
          method: "POST", redirect: "error", signal: controller.signal,
          headers: { "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`, "X-Request-ID": requestId },
          body: JSON.stringify(payload),
        });
        clearTimeout(timer);
        phase = "response";
        timer = setTimeout(() => controller.abort(), config.responseTimeoutMs);
        if (!response.ok) {
          // Never log/return provider error bodies: they may echo submitted material.
          await response.body?.cancel();
          const status = response.status;
          const code = status === 401 || status === 403 ? "NVIDIA_AUTHENTICATION"
            : status === 429 ? "NVIDIA_RATE_LIMIT"
            : status === 408 || status >= 500 ? "NVIDIA_UNAVAILABLE" : "NVIDIA_REQUEST_REJECTED";
          throw new NvidiaError(code, {
            NVIDIA_AUTHENTICATION: "NVIDIA authentication failed",
            NVIDIA_RATE_LIMIT: "NVIDIA rate limit reached; try again later",
            NVIDIA_UNAVAILABLE: "NVIDIA service is unavailable",
            NVIDIA_REQUEST_REJECTED: "NVIDIA rejected the request; check model and parameters",
          }[code], requestId, status);
        }
        // Limit streamed response size as well as time (including embedding batches).
        if (!response.body) throw malformed(requestId);
        const reader = response.body.getReader();
        const chunks = [];
        let bytes = 0;
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            bytes += value.byteLength;
            if (bytes > 4 * 1024 * 1024) {
              await reader.cancel();
              throw malformed(requestId);
            }
            chunks.push(Buffer.from(value));
          }
        } finally { reader.releaseLock(); }
        let data;
        try { data = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
        catch (_) { throw malformed(requestId); }
        this.log({ requestId, operation: endpoint, attempt, status: "ok", durationMs: Date.now() - started });
        return { data, requestId };
      } catch (error) {
        const failure = error instanceof NvidiaError ? error : new NvidiaError(
          controller.signal.aborted ? "NVIDIA_TIMEOUT" : "NVIDIA_UNAVAILABLE",
          controller.signal.aborted ? `NVIDIA ${phase} deadline exceeded` : "NVIDIA connection failed",
          requestId
        );
        const transient = ["NVIDIA_TIMEOUT", "NVIDIA_UNAVAILABLE", "NVIDIA_RATE_LIMIT"].includes(failure.code);
        this.log({ requestId, operation: endpoint, attempt, status: failure.code, durationMs: Date.now() - started });
        if (!transient || attempt === config.retries) throw failure;
      } finally { clearTimeout(timer); parentSignal?.removeEventListener("abort", abort); }
      if (parentSignal?.aborted) throw new NvidiaError("NVIDIA_TIMEOUT", "Assistant workflow deadline exceeded", requestId);
      await this.sleep(250 * 2 ** attempt);
    }
  }

  log(metadata) {
    // Only application-created metadata; no URL, key, prompts, response text or raw errors.
    this.logger?.info(JSON.stringify({ service: "nvidia", ...metadata }));
  }

  async chat(messages, { json = false } = {}) {
    if (!Array.isArray(messages) || !messages.length || messages.length > 20 ||
      messages.some((m) => !m || !["system", "user", "assistant"].includes(m.role) ||
        typeof m.content !== "string" || !m.content.trim()) ||
      Buffer.byteLength(JSON.stringify(messages)) > 48000) {
      throw invalid("Provide 1–20 text messages totaling at most 48000 bytes");
    }
    const config = this.settings();
    if (this.budgetService) {
      try {
        this.budgetService.checkBudget(config.maxTokens);
      } catch (err) {
        throw new NvidiaError(err.code || "AI_BUDGET_EXCEEDED", err.message, null, 429);
      }
    }
    const { data, requestId } = await this.request("chat/completions", {
      model: config.chatModel, messages, temperature: 0.2, top_p: 0.95,
      max_tokens: config.maxTokens, stream: false,
      chat_template_kwargs: { enable_thinking: false },
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }, config);
    if (data?.usage && this.budgetService) {
      this.budgetService.recordUsage({
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
        model: config.chatModel,
      });
    }
    const choice = data?.choices?.[0];
    if (choice?.finish_reason !== "stop" || typeof choice?.message?.content !== "string" ||
      !choice.message.content.trim() || choice.message.content.length > 100000) throw malformed(requestId);
    return { text: choice.message.content, requestId, model: config.chatModel };
  }

  async embed(texts, inputType) {
    if (!["passage", "query"].includes(inputType) || !Array.isArray(texts) ||
      !texts.length || texts.length > 16 || texts.some((t) => typeof t !== "string" ||
        !t.trim() || Buffer.byteLength(t) > 3000)) {
      throw invalid("Provide 1–16 nonempty texts of at most 3000 bytes and passage/query mode");
    }
    const config = this.settings();
    if (this.budgetService) {
      try {
        this.budgetService.checkBudget(500);
      } catch (err) {
        throw new NvidiaError(err.code || "AI_BUDGET_EXCEEDED", err.message, null, 429);
      }
    }
    const { data, requestId } = await this.request("embeddings", {
      model: config.embeddingModel, input: texts, input_type: inputType,
      encoding_format: "float", truncate: "NONE",
    }, config);

    if (!Array.isArray(data?.data) || data.data.length !== texts.length) throw malformed(requestId);
    const ordered = [...data.data].sort((a, b) => a?.index - b?.index);
    if (ordered.some((item, index) => item?.index !== index ||
      !Array.isArray(item.embedding) || item.embedding.length !== config.embeddingDimensions ||
      !item.embedding.every(Number.isFinite) || !item.embedding.some((x) => x !== 0))) throw malformed(requestId);
    return { vectors: ordered.map((item) => item.embedding), requestId,
      model: config.embeddingModel, dimensions: config.embeddingDimensions };
  }
}

module.exports = { NvidiaService, NvidiaError };

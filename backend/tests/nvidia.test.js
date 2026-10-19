const { NvidiaService } = require("../src/services/nvidia.service");
const { getNvidiaConfig } = require("../src/config/nvidia");

const env = { NVIDIA_API_KEY: "test-key-never-log", NVIDIA_EMBEDDING_DIMENSIONS: "3" };
const reply = (content = "READY", finish_reason = "stop") => ({
  choices: [{ finish_reason, message: { content } }],
});
const response = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json" },
});
const messages = [{ role: "user", content: "Synthetic diagnostic" }];
function setup(overrides = {}) {
  const fetchImpl = jest.fn().mockResolvedValue(response(reply()));
  const logger = { info: jest.fn() };
  const sleep = jest.fn().mockResolvedValue();
  const provider = new NvidiaService({ env, fetchImpl, logger, sleep, ...overrides });
  return { provider, fetchImpl, logger, sleep };
}

describe("optional NVIDIA provider", () => {
  test("existing health route remains healthy without AI credentials", async () => {
    const express = require("express");
    const request = require("supertest");
    const app = express();
    app.use("/health", require("../src/routes/health.routes"));
    const saved = process.env.NVIDIA_API_KEY;
    try {
      delete process.env.NVIDIA_API_KEY;
      const result = await request(app).get("/health");
      expect(result.status).toBe(200);
      expect(result.body.data).toMatchObject({ status: "ok", service: "securepatch-backend",
        ai: { configured: false, reachable: null, status: "missing_key" } });
    } finally {
      if (saved === undefined) delete process.env.NVIDIA_API_KEY;
      else process.env.NVIDIA_API_KEY = saved;
    }
  });
  test("health makes no request and never exposes credentials", () => {
    const { provider, fetchImpl } = setup();
    expect(provider.health()).toMatchObject({ configured: true, reachable: null });
    expect(JSON.stringify(provider.health())).not.toContain(env.NVIDIA_API_KEY);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(setup({ env: {} }).provider.health().status).toBe("missing_key");
  });

  test("invalid config is diagnosed without throwing on startup", () => {
    expect(setup({ env: { NVIDIA_BASE_URL: "http://example.com" } }).provider.health())
      .toMatchObject({ configured: false, status: "invalid_configuration" });
  });

  test.each([
    { NVIDIA_BASE_URL: "https://key@example.com/v1" },
    { NVIDIA_BASE_URL: "https://example.com/v1?api_key=secret" },
    { NVIDIA_MAX_RETRIES: "50" },
    { NVIDIA_MAX_TOKENS: "NaN" },
    { NVIDIA_EMBEDDING_DIMENSIONS: "0" },
    { NVIDIA_CHAT_MODEL: "invalid\nmodel" },
  ])("rejects invalid configuration %j", (bad) => {
    expect(() => getNvidiaConfig(bad)).toThrow();
  });

  test("official default models and dimensions are centralized", () => {
    expect(getNvidiaConfig({})).toMatchObject({
      baseUrl: "https://integrate.api.nvidia.com/v1",
      chatModel: "nvidia/nemotron-3.5-lightning-30b-a3b",
      embeddingModel: "nvidia/nemotron-3-embed-1b", embeddingDimensions: 2048,
    });
  });

  test("missing key is controlled and never calls fetch", async () => {
    const { provider, fetchImpl } = setup({ env: {} });
    await expect(provider.chat(messages)).rejects.toMatchObject({ code: "NVIDIA_NOT_CONFIGURED" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("chat uses hosted endpoint, conservative limits and safe logging", async () => {
    const { provider, fetchImpl, logger } = setup();
    const result = await provider.chat(messages);
    expect(result).toMatchObject({ text: "READY", requestId: expect.any(String) });
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://integrate.api.nvidia.com/v1/chat/completions");
    expect(options.redirect).toBe("error");
    expect(options.headers.Authorization).toBe(`Bearer ${env.NVIDIA_API_KEY}`);
    expect(JSON.parse(options.body)).toMatchObject({ max_tokens: 2048,
      stream: false, temperature: 0.2, chat_template_kwargs: { enable_thinking: false } });
    expect(JSON.parse(options.body)).not.toHaveProperty("response_format");
    const logs = JSON.stringify(logger.info.mock.calls);
    expect(logs).not.toContain(env.NVIDIA_API_KEY);
    expect(logs).not.toContain(messages[0].content);
    expect(logs).not.toContain("READY");
  });

  test("structured output explicitly requests provider JSON mode", async () => {
    const { provider, fetchImpl } = setup();
    await provider.chat(messages, { json: true });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).response_format)
      .toEqual({ type: "json_object" });
  });

  test.each([[], [{ role: "tool", content: "x" }], [{ role: "user", content: "" }],
    [{ role: "user", content: "x".repeat(48001) }], [null]].map((input) => [input]))("rejects malformed/large messages case %#", async (input) => {
    const { provider, fetchImpl } = setup();
    await expect(provider.chat(input)).rejects.toMatchObject({ code: "NVIDIA_INVALID_INPUT" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test.each([401, 403, 400, 404, 422])("does not retry HTTP %i or expose echoed errors", async (status) => {
    const { provider, fetchImpl, logger } = setup();
    fetchImpl.mockResolvedValue(response({ error: "secret prompt test-key-never-log" }, status));
    await expect(provider.chat(messages)).rejects.toMatchObject({ status, requestId: expect.any(String) });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain("secret prompt");
  });

  test.each([408, 429, 500, 503])("retries HTTP %i only within configured bound", async (status) => {
    const { provider, fetchImpl, sleep } = setup();
    fetchImpl.mockImplementation(async () => response({}, status));
    await expect(provider.chat(messages)).rejects.toMatchObject({ status });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[250], [500]]);
    const ids = fetchImpl.mock.calls.map(([, options]) => options.headers["X-Request-ID"]);
    expect(new Set(ids).size).toBe(1);
  });

  test("transient failure can recover", async () => {
    const { provider, fetchImpl } = setup();
    fetchImpl.mockRejectedValueOnce(new Error("private network detail"))
      .mockResolvedValueOnce(response(reply()));
    await expect(provider.chat(messages)).resolves.toMatchObject({ text: "READY" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  test("connection timeout aborts and returns a safe error", async () => {
    const fetchImpl = jest.fn((_, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("transport detail")), { once: true });
    }));
    const { provider } = setup({ fetchImpl, env: { ...env,
      NVIDIA_CONNECTION_TIMEOUT_MS: "5", NVIDIA_MAX_RETRIES: "0" } });
    await expect(provider.embed(["query"], "query")).rejects.toMatchObject({ code: "NVIDIA_TIMEOUT",
      message: "NVIDIA connection deadline exceeded" });
  });

  test("non-streaming inference can wait beyond the connection budget", async () => {
    const { provider } = setup({ env: { ...env, NVIDIA_CONNECTION_TIMEOUT_MS: "5",
      NVIDIA_RESPONSE_TIMEOUT_MS: "1000", NVIDIA_MAX_RETRIES: "0" },
      fetchImpl: async (_, { signal }) => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        if (signal.aborted) throw new Error("aborted");
        return response(reply());
      } });
    await expect(provider.chat(messages)).resolves.toMatchObject({ text: "READY" });
  });

  test("response-body timeout aborts a stalled stream", async () => {
    const fetchImpl = jest.fn(async (_, { signal }) => new Response(new ReadableStream({
      start(controller) {
        signal.addEventListener("abort", () => controller.error(new Error("aborted")), { once: true });
      },
    })));
    const { provider } = setup({ fetchImpl, env: { ...env,
      NVIDIA_RESPONSE_TIMEOUT_MS: "5", NVIDIA_MAX_RETRIES: "0" } });
    await expect(provider.chat(messages)).rejects.toMatchObject({ code: "NVIDIA_TIMEOUT",
      message: "NVIDIA response deadline exceeded" });
  });

  test.each([{}, null, reply(""), reply("partial", "length"), reply(null), reply("no", "content_filter")])(
    "rejects malformed/truncated chat response %j without retry", async (data) => {
      const { provider, fetchImpl } = setup();
      fetchImpl.mockResolvedValue(response(data));
      await expect(provider.chat(messages)).rejects.toMatchObject({ code: "NVIDIA_INVALID_RESPONSE" });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    }
  );

  test("rejects malformed JSON", async () => {
    const { provider, fetchImpl } = setup();
    fetchImpl.mockResolvedValue(new Response("not JSON"));
    await expect(provider.chat(messages)).rejects.toMatchObject({ code: "NVIDIA_INVALID_RESPONSE" });
  });

  test("limits response bytes", async () => {
    const { provider, fetchImpl } = setup();
    fetchImpl.mockResolvedValue(new Response("x".repeat(4 * 1024 * 1024 + 1)));
    await expect(provider.chat(messages)).rejects.toMatchObject({ code: "NVIDIA_INVALID_RESPONSE" });
  });

  test.each(["passage", "query"])("embedding uses %s mode and restores response order", async (mode) => {
    const { provider, fetchImpl } = setup();
    fetchImpl.mockResolvedValue(response({ data: [
      { index: 1, embedding: [0, 1, 0] }, { index: 0, embedding: [1, 0, 0] },
    ] }));
    const result = await provider.embed(["one", "two"], mode);
    expect(result.vectors).toEqual([[1, 0, 0], [0, 1, 0]]);
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toMatch(/\/embeddings$/);
    expect(JSON.parse(options.body)).toMatchObject({ input_type: mode,
      encoding_format: "float", truncate: "NONE" });
  });

  test.each([
    [], [{ index: 0, embedding: [1, 2] }], [{ index: 0, embedding: [0, 0, 0] }],
    [{ index: 1, embedding: [1, 2, 3] }], [{ index: 0, embedding: [1, null, 3] }],
    [null], [{ index: 0, embedding: ["1", 2, 3] }],
  ].map((data) => [data]))("rejects incompatible embedding response case %#", async (data) => {
    const { provider, fetchImpl } = setup();
    fetchImpl.mockResolvedValue(response({ data }));
    await expect(provider.embed(["one"], "query")).rejects.toMatchObject({ code: "NVIDIA_INVALID_RESPONSE" });
  });

  test.each([[[], "query"], [[""], "query"], [["x"], "document"], [["x".repeat(3001)], "passage"]])(
    "rejects embedding input bounds", async (texts, mode) => {
      const { provider, fetchImpl } = setup();
      await expect(provider.embed(texts, mode)).rejects.toMatchObject({ code: "NVIDIA_INVALID_INPUT" });
      expect(fetchImpl).not.toHaveBeenCalled();
    }
  );
});

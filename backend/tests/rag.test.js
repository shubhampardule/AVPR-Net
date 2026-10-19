const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { RagService, chunkText } = require("../src/services/rag.service");
const { redact, sanitize } = require("../src/services/ai-safety");

const env = { NVIDIA_EMBEDDING_DIMENSIONS: "3" };
const model = "nvidia/nemotron-3-embed-1b";
const vector = (text) => /authentication|SSH|login/i.test(text) ? [1, 0, 0] : [0, 1, 0];
let root, provider, rag;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "securepatch-rag-test-"));
  provider = { embed: jest.fn(async (texts) => ({ vectors: texts.map(vector), model, dimensions: 3 })) };
  rag = new RagService({ root, indexPath: path.join(root, ".local/index.json"), env, provider });
});
afterEach(async () => {
  // Only this test's validated mkdtemp directory is removed.
  if (path.dirname(root) !== os.tmpdir() || !path.basename(root).startsWith("securepatch-rag-test-")) throw new Error("Unsafe test cleanup");
  await fs.rm(root, { recursive: true, force: true });
});
const write = (name, text) => fs.writeFile(path.join(root, name), text);
const sources = [{ path: "auth.md", type: "guidance" }, { path: "code.md", type: "example" }];

test("chunks Unicode and long lines within byte cap, with overlapping line metadata", () => {
  const chunks = chunkText("abc\n".repeat(1000) + "😀".repeat(1000));
  expect(chunks.length).toBeGreaterThan(3);
  expect(chunks.every((c) => Buffer.byteLength(c.text) <= 2200)).toBe(true);
  expect(chunks[1].startLine).toBeLessThanOrEqual(chunks[0].endLine);
});

test("Markdown headings preserve topic boundaries and source lines", () => {
  const chunks = chunkText("# Guide\nOverview\n## Python\nUse argument lists.\n## C and C++\nBound buffer sizes.\n");
  expect(chunks).toHaveLength(3);
  expect(chunks[1]).toMatchObject({ text: "## Python\nUse argument lists.", startLine: 3, endLine: 4 });
  expect(chunks[2].text).not.toContain("Python");
});

test("persistent index reload, incremental reuse, source deletion and top-k filtering", async () => {
  await write("auth.md", "SSH authentication failures require review of successful login events.");
  await write("code.md", "Use parameterized SQL queries.");
  expect(await rag.ingest(sources)).toMatchObject({ chunks: 2, embedded: 2 });
  expect(provider.embed.mock.calls[0][1]).toBe("passage");
  const reopened = new RagService({ root, indexPath: rag.indexPath, provider, env });
  const found = await reopened.retrieve("SSH authentication", { k: 1 });
  expect(found.sources.map((s) => s.source)).toEqual(["auth.md"]);
  expect(found.sources[0]).toMatchObject({ startLine: 1, endLine: 1, type: "guidance", language: "md" });
  expect(found.sources[0].vector).toBeUndefined();
  expect(provider.embed.mock.calls.at(-1)[1]).toBe("query");
  expect(await rag.ingest(sources)).toMatchObject({ embedded: 0, reused: 2 });
  await write("auth.md", "SSH authentication failures: review inventory and login events.");
  expect(await rag.ingest(sources)).toMatchObject({ embedded: 1, reused: 1 });
  await rag.ingest(sources.slice(1));
  expect((await rag.diagnostics()).sources).toEqual(["code.md"]);
  expect((await rag.retrieve("authentication", { type: "example" })).status).toBe("insufficient");
});

test("empty index does not call embedding API", async () => {
  expect(await rag.retrieve("hello")).toEqual({ status: "empty", sources: [] });
  expect(provider.embed).not.toHaveBeenCalled();
});

test("a fresh Vercel instance can read the bundled approved corpus without a local file", async () => {
  const bundled = require("../knowledge/index.json");
  const hosted = new RagService({ root, indexPath: path.join(root, "missing.json"), provider,
    env: { VERCEL: "1", NVIDIA_BASE_URL: bundled.signature.endpoint,
      NVIDIA_EMBEDDING_MODEL: bundled.signature.model,
      NVIDIA_EMBEDDING_DIMENSIONS: String(bundled.signature.dimensions) } });
  const status = await hosted.diagnostics();
  expect(status.status).toBe("ready");
  expect(status.chunks).toBeGreaterThan(0);
  expect(status.sources).toContain("backend/knowledge/secure-coding.md");
  expect(provider.embed).not.toHaveBeenCalled();
});

test("stale signature requires rebuild; explicit rebuild works", async () => {
  await write("auth.md", "SSH authentication");
  await rag.ingest(sources.slice(0, 1));
  rag.env = { ...env, NVIDIA_EMBEDDING_MODEL: "another/model" };
  await expect(rag.retrieve("hello")).rejects.toMatchObject({ code: "RAG_STALE_INDEX" });
  await expect(rag.ingest(sources.slice(0, 1))).rejects.toMatchObject({ code: "RAG_STALE_INDEX" });
  provider.embed.mockImplementation(async (texts) => ({ vectors: texts.map(vector), model: "another/model", dimensions: 3 }));
  await expect(rag.ingest(sources.slice(0, 1), { rebuild: true })).resolves.toMatchObject({ embedded: 1 });
});

test("failed rebuild preserves previous usable index and releases lock", async () => {
  await write("auth.md", "SSH authentication");
  await rag.ingest(sources.slice(0, 1));
  const before = await fs.readFile(rag.indexPath, "utf8");
  provider.embed.mockRejectedValueOnce(new Error("offline"));
  await expect(rag.ingest(sources.slice(0, 1), { rebuild: true })).rejects.toThrow("offline");
  expect(await fs.readFile(rag.indexPath, "utf8")).toBe(before);
  expect(await rag.ingest(sources.slice(0, 1))).toMatchObject({ embedded: 0 });
});

test.each(["../outside.md", ".env", "secrets/token.txt", "node_modules/readme.md", "x.pem", "package-lock.json"])(
  "rejects unsafe source %s", async (file) => {
    await expect(rag.collect([{ path: file, type: "project" }])).rejects.toMatchObject({ code: "RAG_UNSAFE_SOURCE" });
  }
);

test("binary, oversized, duplicate and malformed sources are rejected", async () => {
  await write("auth.md", "hello\0world");
  await expect(rag.collect(sources.slice(0, 1))).rejects.toMatchObject({ code: "RAG_UNSAFE_SOURCE" });
  await write("auth.md", "x".repeat(200001));
  await expect(rag.collect(sources.slice(0, 1))).rejects.toMatchObject({ code: "RAG_UNSAFE_SOURCE" });
  await write("auth.md", "hello");
  await expect(rag.collect([sources[0], sources[0]])).rejects.toMatchObject({ code: "RAG_INVALID_SOURCES" });
  await expect(rag.collect([])).rejects.toMatchObject({ code: "RAG_INVALID_SOURCES" });
});

test("secrets are removed before embedding and persistence", async () => {
  await write("auth.md", 'password="my-secret-value"\nNVIDIA_API_KEY=nvapi-demo123456\ncontact person@example.com');
  await rag.ingest(sources.slice(0, 1));
  const stored = await fs.readFile(rag.indexPath, "utf8");
  expect(stored).not.toContain("my-secret-value");
  expect(stored).not.toContain("nvapi-demo123456");
  expect(stored).not.toContain("person@example.com");
  expect(provider.embed.mock.calls[0][0][0]).toContain("REDACTED");
});

test("corrupt and wrong-dimension indexes are controlled failures", async () => {
  await fs.mkdir(path.dirname(rag.indexPath));
  await fs.writeFile(rag.indexPath, "bad JSON");
  await expect(rag.read()).rejects.toMatchObject({ code: "RAG_INVALID_INDEX" });
  await write("auth.md", "SSH authentication");
  await rag.ingest(sources.slice(0, 1), { rebuild: true });
  const data = JSON.parse(await fs.readFile(rag.indexPath));
  data.chunks[0].vector = [1, 0];
  await fs.writeFile(rag.indexPath, JSON.stringify(data));
  await expect(rag.read()).rejects.toMatchObject({ code: "RAG_INVALID_INDEX" });
});

test("incompatible embedding provider cannot replace the index", async () => {
  await write("auth.md", "SSH authentication");
  provider.embed.mockResolvedValue({ vectors: [[1, 2]], model, dimensions: 2 });
  await expect(rag.ingest(sources.slice(0, 1))).rejects.toMatchObject({ code: "RAG_EMBEDDING_MISMATCH" });
  expect(await rag.read()).toBeNull();
});

test.each([["", {}], ["x", { k: 9 }], ["x", { type: "private" }], ["x", { minScore: 2 }]])(
  "rejects query bounds", async (query, options) => {
    await expect(rag.retrieve(query, options)).rejects.toMatchObject({ code: "RAG_INVALID_QUERY" });
  }
);

test("structured sensitive fields and representative tokens are redacted", () => {
  expect(sanitize({ password: "value", nested: { source_ip: "192.0.2.1", note: "Bearer abc123" } }))
    .toEqual({ password: "[REDACTED]", nested: { source_ip: "[REDACTED]", note: "Bearer [REDACTED]" } });
  expect(redact("-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----")).toBe("[REDACTED PRIVATE KEY]\n\n");
});

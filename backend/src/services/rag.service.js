const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const { getNvidiaConfig } = require("../config/nvidia");
const { redact } = require("./ai-safety");

const hash = (text) => createHash("sha256").update(text).digest("hex");
const VERSION = "sections-lines-2200bytes-overlap2-v2";
const MAX_CHUNKS = 500;
const fail = (code, message) => Object.assign(new Error(message), { code });
const vectorValid = (v, dimensions) => Array.isArray(v) && v.length === dimensions &&
  v.every(Number.isFinite) && v.some((x) => x !== 0);

function chunkText(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const units = [];
  lines.forEach((line, index) => {
    let part = "";
    for (const char of line) {
      if (Buffer.byteLength(part + char) > 1800) {
        units.push({ text: part, line: index + 1 }); part = "";
      }
      part += char;
    }
    units.push({ text: part, line: index + 1 });
  });
  const result = [];
  let start = 0;
  while (start < units.length) {
    let end = start;
    let content = "";
    while (end < units.length && Buffer.byteLength(content + units[end].text + "\n") <= 2200) {
      if (content.trim() && /^#{1,3}\s/.test(units[end].text)) break;
      content += units[end].text + "\n"; end++;
    }
    if (content.trim()) result.push({ text: content.trim(), startLine: units[start].line,
      endLine: units[end - 1].line });
    if (end === units.length) break;
    start = /^#{1,3}\s/.test(units[end].text) ? end : Math.max(start + 1, end - 2);
  }
  return result;
}

function cosine(a, b) {
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; aa += a[i] ** 2; bb += b[i] ** 2; }
  return dot / Math.sqrt(aa * bb);
}

class RagService {
  constructor({ provider, root = path.resolve(process.cwd(), ".."),
    indexPath = path.resolve(process.cwd(), ".local/knowledge.json"), env = process.env } = {}) {
    this.provider = provider;
    this.root = root;
    this.indexPath = indexPath;
    this.env = env;
  }

  signature() {
    const config = getNvidiaConfig(this.env);
    return { version: VERSION, model: config.embeddingModel, dimensions: config.embeddingDimensions,
      endpoint: config.baseUrl, collection: "approved-shared" };
  }

  async read({ allowStale = false } = {}) {
    let stat;
    let index;
    try { stat = await fs.stat(this.indexPath); }
    catch (error) {
      if (error.code !== "ENOENT") throw error;
      if (this.env.VERCEL !== "1") return null;
      // The immutable, approved shared corpus is bundled by esbuild so a fresh
      // serverless instance does not depend on a writable/local indexing cache.
      index = require("../../knowledge/index.json");
    }
    if (!index) {
      if (stat.size > 64 * 1024 * 1024) throw fail("RAG_INVALID_INDEX", "Index exceeds the size limit");
      try { index = JSON.parse(await fs.readFile(this.indexPath, "utf8")); }
      catch (_) { throw fail("RAG_INVALID_INDEX", "Index is unreadable; rebuild the approved corpus"); }
    }
    const signature = this.signature();
    if (!allowStale && JSON.stringify(index.signature) !== JSON.stringify(signature)) {
      throw fail("RAG_STALE_INDEX", "Embedding model, endpoint or chunker changed; rebuild the index");
    }
    if (!index.signature || !Number.isInteger(index.signature.dimensions) ||
      !Array.isArray(index.chunks) || index.chunks.length > MAX_CHUNKS || index.chunks.some((c) =>
        !c || typeof c.id !== "string" || typeof c.source !== "string" ||
        typeof c.text !== "string" || Buffer.byteLength(c.text) > 3000 ||
        !Number.isInteger(c.startLine) || !Number.isInteger(c.endLine) ||
        !vectorValid(c.vector, index.signature.dimensions))) {
      throw fail("RAG_INVALID_INDEX", "Index contents are invalid; rebuild the approved corpus");
    }
    return index;
  }

  async collect(sources) {
    if (!Array.isArray(sources) || !sources.length || sources.length > 50) {
      throw fail("RAG_INVALID_SOURCES", "Configure 1–50 explicit approved files");
    }
    const root = await fs.realpath(this.root);
    const chunks = [];
    const seen = new Set();
    for (const entry of sources) {
      if (!entry || typeof entry.path !== "string" || !["project", "guidance", "example"].includes(entry.type)) {
        throw fail("RAG_INVALID_SOURCES", "Each source needs a path and project/guidance/example type");
      }
      const file = path.resolve(root, entry.path);
      const relative = path.relative(root, file).replace(/\\/g, "/");
      const parts = relative.split("/");
      if (path.isAbsolute(relative) || parts.includes("..") || parts.some((p) =>
        /^(?:\..*|node_modules|dist|build|coverage|venv|__pycache__|logs|secrets|attachments)$/i.test(p)) ||
        /(?:secret|credential|private.?key|package-lock)/i.test(relative) ||
        !/\.(?:md|txt|js|jsx|ts|tsx|py|c|cpp|h|sh|ya?ml)$/i.test(relative)) {
        throw fail("RAG_UNSAFE_SOURCE", "Source is outside approved file types or directories");
      }
      const real = await fs.realpath(file);
      const stat = await fs.lstat(file);
      // Reject symbolic paths, including directory junctions that change resolution.
      if (real.toLowerCase() !== file.toLowerCase() || stat.isSymbolicLink() || !stat.isFile() || stat.size > 200000) {
        throw fail("RAG_UNSAFE_SOURCE", "Source must be a small regular file within the project");
      }
      if (seen.has(relative)) throw fail("RAG_INVALID_SOURCES", "Duplicate source path");
      seen.add(relative);
      const raw = await fs.readFile(real, "utf8");
      if (raw.includes("\0")) throw fail("RAG_UNSAFE_SOURCE", "Binary source is excluded");
      const text = redact(raw);
      for (const chunk of chunkText(text)) {
        const contentHash = hash(chunk.text);
        chunks.push({ ...chunk, source: relative, type: entry.type,
          language: path.extname(relative).slice(1), contentHash,
          id: hash(`${relative}:${chunk.startLine}:${chunk.endLine}:${contentHash}`).slice(0, 24) });
        if (chunks.length > MAX_CHUNKS) throw fail("RAG_CORPUS_LIMIT", "Approved corpus exceeds 500 chunks");
      }
    }
    return chunks;
  }

  async ingest(sources, { rebuild = false } = {}) {
    const chunks = await this.collect(sources);
    await fs.mkdir(path.dirname(this.indexPath), { recursive: true });
    let lock;
    try { lock = await fs.open(`${this.indexPath}.lock`, "wx", 0o600); }
    catch (error) {
      if (error.code === "EEXIST") throw fail("RAG_BUSY", "Another indexing process holds the lock");
      throw error;
    }
    const temp = `${this.indexPath}.${randomUUID()}.tmp`;
    try {
      const old = rebuild ? null : await this.read();
      const cache = new Map((old?.chunks || []).map((chunk) => [chunk.contentHash, chunk.vector]));
      let embedded = 0;
      const pending = chunks.filter((c) => !cache.has(c.contentHash));
      for (let i = 0; i < pending.length; i += 16) {
        const batch = pending.slice(i, i + 16);
        const result = await this.provider.embed(batch.map((c) => c.text), "passage");
        if (result.model !== this.signature().model || result.dimensions !== this.signature().dimensions ||
          result.vectors.length !== batch.length || result.vectors.some((v) => !vectorValid(v, result.dimensions))) {
          throw fail("RAG_EMBEDDING_MISMATCH", "Embedding provider returned incompatible vectors");
        }
        batch.forEach((c, j) => cache.set(c.contentHash, result.vectors[j]));
        embedded += batch.length;
      }
      const index = { signature: this.signature(), updatedAt: new Date().toISOString(),
        chunks: chunks.map((c) => ({ ...c, vector: cache.get(c.contentHash) })) };
      await fs.writeFile(temp, JSON.stringify(index), { flag: "wx", mode: 0o600 });
      await fs.rename(temp, this.indexPath);
      return { chunks: chunks.length, embedded, reused: chunks.length - embedded, updatedAt: index.updatedAt };
    } finally {
      await fs.unlink(temp).catch((e) => { if (e.code !== "ENOENT") throw e; });
      await lock.close();
      await fs.unlink(`${this.indexPath}.lock`);
    }
  }

  async retrieve(query, { k = 4, type, minScore = 0.2 } = {}) {
    if (typeof query !== "string" || !query.trim() || Buffer.byteLength(query) > 3000 ||
      !Number.isInteger(k) || k < 1 || k > 8 ||
      (type !== undefined && !["project", "guidance", "example"].includes(type)) ||
      !Number.isFinite(minScore) || minScore < -1 || minScore > 1) {
      throw fail("RAG_INVALID_QUERY", "Invalid retrieval query or filters");
    }
    const index = await this.read();
    const candidates = (index?.chunks || []).filter((c) => !type || c.type === type);
    if (!candidates.length) return { status: "empty", sources: [] };
    const result = await this.provider.embed([redact(query)], "query");
    if (result.model !== this.signature().model || result.dimensions !== this.signature().dimensions ||
      !vectorValid(result.vectors?.[0], this.signature().dimensions)) {
      throw fail("RAG_EMBEDDING_MISMATCH", "Query embedding does not match the index");
    }
    const sources = candidates.map(({ vector, ...metadata }) => ({ ...metadata,
      score: cosine(result.vectors[0], vector) })).filter((c) => c.score >= minScore)
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, k);
    return { status: sources.length ? "ready" : "insufficient", sources,
      updatedAt: index.updatedAt, requestId: result.requestId };
  }

  async diagnostics() {
    const index = await this.read();
    return { status: index?.chunks.length ? "ready" : "empty", chunks: index?.chunks.length || 0,
      signature: this.signature(), updatedAt: index?.updatedAt || null,
      sources: [...new Set((index?.chunks || []).map((c) => c.source))] };
  }
}

module.exports = { RagService, chunkText, cosine };

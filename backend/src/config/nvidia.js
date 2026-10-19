// Optional provider settings: loading this module never requires a key or database.
const integer = (env, name, fallback, min, max) => {
  const value = env[name] === undefined || env[name] === "" ? fallback : Number(env[name]);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
};

function getNvidiaConfig(env = process.env) {
  const url = new URL(env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1");
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("NVIDIA_BASE_URL must be an HTTPS URL without credentials, query or fragment");
  }
  const model = (name, fallback) => {
    const value = env[name] || fallback;
    if (!/^[a-zA-Z0-9_./-]{1,160}$/.test(value)) throw new Error(`${name} is invalid`);
    return value;
  };
  return Object.freeze({
    apiKey: (env.NVIDIA_API_KEY || "").trim(),
    baseUrl: url.toString().replace(/\/$/, ""),
    chatModel: model("NVIDIA_CHAT_MODEL", "nvidia/nemotron-3.5-lightning-30b-a3b"),
    embeddingModel: model("NVIDIA_EMBEDDING_MODEL", "nvidia/nemotron-3-embed-1b"),
    embeddingDimensions: integer(env, "NVIDIA_EMBEDDING_DIMENSIONS", 2048, 1, 16384),
    connectionTimeoutMs: integer(env, "NVIDIA_CONNECTION_TIMEOUT_MS", 30000, 1, 60000),
    responseTimeoutMs: integer(env, "NVIDIA_RESPONSE_TIMEOUT_MS", 60000, 1, 180000),
    retries: integer(env, "NVIDIA_MAX_RETRIES", 2, 0, 3),
    maxTokens: integer(env, "NVIDIA_MAX_TOKENS", 2048, 16, 8192),
  });
}

module.exports = { getNvidiaConfig };

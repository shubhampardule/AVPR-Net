// Optional provider settings: loading this module never requires a key or database.
const integer = (env, name, fallback, min, max) => {
  const value = env[name] === undefined || env[name] === "" ? fallback : Number(env[name]);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
};

const floatNumber = (env, name, fallback, min, max) => {
  const value = env[name] === undefined || env[name] === "" ? fallback : Number(env[name]);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} must be a number between ${min} and ${max}`);
  }
  return value;
};

function getNvidiaConfig(env = process.env) {
  const isNebius = Boolean(
    env.NEBIUS_API_KEY ||
    env.NEBIUS_BASE_URL ||
    (env.NVIDIA_BASE_URL && env.NVIDIA_BASE_URL.includes("nebius"))
  );

  const rawUrl = env.NEBIUS_BASE_URL || env.NVIDIA_BASE_URL || (
    isNebius ? "https://api.tokenfactory.nebius.com/v1" : "https://integrate.api.nvidia.com/v1"
  );

  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    const varName = env.NEBIUS_BASE_URL ? "NEBIUS_BASE_URL" : "NVIDIA_BASE_URL";
    throw new Error(`${varName} must be an HTTPS URL without credentials, query or fragment`);
  }

  const model = (name, fallback) => {
    const value = env[name] || fallback;
    if (!/^[a-zA-Z0-9_./-]{1,160}$/.test(value)) throw new Error(`${name} is invalid`);
    return value;
  };

  const defaultChatModel = isNebius
    ? "nvidia/Nemotron-3_5-Lightning"
    : "nvidia/nemotron-3.5-lightning-30b-a3b";

  return Object.freeze({
    provider: isNebius ? "nebius" : "nvidia",
    providerName: isNebius ? "Nebius Token Factory" : "NVIDIA NIM",
    apiKey: (env.NEBIUS_API_KEY || env.NVIDIA_API_KEY || "").trim(),
    baseUrl: url.toString().replace(/\/$/, ""),
    chatModel: model(env.NEBIUS_CHAT_MODEL ? "NEBIUS_CHAT_MODEL" : "NVIDIA_CHAT_MODEL", defaultChatModel),
    embeddingModel: model(env.NEBIUS_EMBEDDING_MODEL ? "NEBIUS_EMBEDDING_MODEL" : "NVIDIA_EMBEDDING_MODEL", "nvidia/nemotron-3-embed-1b"),
    embeddingDimensions: integer(env, "NVIDIA_EMBEDDING_DIMENSIONS", 2048, 1, 16384),
    connectionTimeoutMs: integer(env, "NVIDIA_CONNECTION_TIMEOUT_MS", 30000, 1, 60000),
    responseTimeoutMs: integer(env, "NVIDIA_RESPONSE_TIMEOUT_MS", 60000, 1, 180000),
    retries: integer(env, "NVIDIA_MAX_RETRIES", 2, 0, 3),
    maxTokens: integer(env, "NVIDIA_MAX_TOKENS", 2048, 16, 8192),
    maxCredits: floatNumber(env, "NEBIUS_BUDGET_CREDITS", 25.0, 0.1, 1000.0),
  });
}

module.exports = { getNvidiaConfig };


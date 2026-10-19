const Redis = require("ioredis");

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
});

redisConnection.on("error", (err) => {
  // Silent or warn to avoid crashing unhandled when Redis is offline
  if (process.env.NODE_ENV !== "test") {
    console.warn(`[Redis Connection Warning] ${err.message}`);
  }
});

module.exports = {
  redisConnection,
  redisUrl,
};

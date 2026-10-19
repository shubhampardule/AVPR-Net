const Redis = require("ioredis");

const redisUrl = process.env.REDIS_URL;
const redisConnection = redisUrl
  ? new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy(times) {
        const delay = Math.min(times * 100, 3000);
        return delay;
      },
    })
  : null;

if (redisConnection) {
  redisConnection.on("error", (err) => {
    if (process.env.NODE_ENV !== "test") {
      console.warn(`[Redis Connection Warning] ${err.message}`);
    }
  });
}

module.exports = {
  redisConnection,
  redisUrl,
};

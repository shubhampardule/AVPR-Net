const { Queue } = require("bullmq");
const { redisConnection } = require("../config/redis");

const SCAN_QUEUE_NAME = "securepatch-scan-queue";

const scanQueue = new Queue(SCAN_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: {
      age: 24 * 3600, // keep 24 hours
      count: 500,
    },
    removeOnFail: {
      age: 48 * 3600,
    },
  },
});

module.exports = {
  scanQueue,
  SCAN_QUEUE_NAME,
};

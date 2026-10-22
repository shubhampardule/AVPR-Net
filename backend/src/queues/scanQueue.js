const { Queue } = require("bullmq");
const { redisConnection } = require("../config/redis");

const SCAN_QUEUE_NAME = "securepatch-scan-queue";
const SCAN_QUEUE_REGION = "bom1";

const useVercelQueue = process.env.VERCEL === "1" &&
  (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production");

const addToVercelQueue = async (name, data) => {
  const [{ QueueClient }, { getVercelOidcToken }] = await Promise.all([
    import("@vercel/queue"),
    import("@vercel/oidc"),
  ]);
  const token = await getVercelOidcToken();
  const queue = new QueueClient({
    region: SCAN_QUEUE_REGION,
    deploymentId: null,
    token,
  });
  const result = await queue.send(SCAN_QUEUE_NAME, { ...data, jobName: name }, {
    idempotencyKey: data.scanId,
    retentionSeconds: 86400,
  });
  return { id: result.messageId || data.scanId };
};

const addToLocalInlineQueue = async (name, data) => {
  const id = `local-${data.scanId}`;
  setImmediate(() => {
    require("../workers/scanWorker").processScanJob({ id, name, data })
      .catch((error) => console.error(`[ScanWorker] Local scan ${data.scanId} failed: ${error.message}`));
  });
  return { id };
};

const scanQueue = useVercelQueue
  ? { add: addToVercelQueue, close: async () => {} }
  : redisConnection
  ? new Queue(SCAN_QUEUE_NAME, {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: {
          age: 24 * 3600,
          count: 500,
        },
        removeOnFail: {
          age: 48 * 3600,
        },
      },
    })
  : process.env.NODE_ENV === "development"
  ? { add: addToLocalInlineQueue, close: async () => {} }
  : {
      add: async () => {
        throw new Error("No scan queue is configured; set REDIS_URL locally or deploy with Vercel Queues");
      },
      close: async () => {},
    };

module.exports = {
  scanQueue,
  SCAN_QUEUE_NAME,
  SCAN_QUEUE_REGION,
  useVercelQueue,
};

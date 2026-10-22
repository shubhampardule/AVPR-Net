test("development scans run through the in-process worker when Redis is not configured", async () => {
  const oldNodeEnv = process.env.NODE_ENV;
  const oldRedisUrl = process.env.REDIS_URL;
  const oldVercel = process.env.VERCEL;
  process.env.NODE_ENV = "development";
  delete process.env.REDIS_URL;
  delete process.env.VERCEL;
  jest.resetModules();
  jest.doMock("../src/workers/scanWorker", () => ({ processScanJob: jest.fn().mockResolvedValue({ success: true }) }));
  try {
    const { scanQueue } = require("../src/queues/scanQueue");
    const result = await scanQueue.add("process-repository-scan", { scanId: "scan-local" });
    await new Promise(resolve => setImmediate(resolve));
    expect(result.id).toBe("local-scan-local");
    expect(require("../src/workers/scanWorker").processScanJob).toHaveBeenCalledWith({
      id: "local-scan-local", name: "process-repository-scan", data: { scanId: "scan-local" },
    });
  } finally {
    jest.dontMock("../src/workers/scanWorker");
    jest.resetModules();
    if (oldNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldNodeEnv;
    if (oldRedisUrl === undefined) delete process.env.REDIS_URL; else process.env.REDIS_URL = oldRedisUrl;
    if (oldVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = oldVercel;
  }
});

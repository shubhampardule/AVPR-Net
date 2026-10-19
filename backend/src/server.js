const app = require("./app");
const env = require("./config/env");
const connectDatabase = require("./config/database");
const logger = require("./config/logger");

const startServer = async () => {
  if (!env.demoMode) await connectDatabase();

  const server = app.listen(env.port, env.demoMode ? "127.0.0.1" : undefined, () => {
    logger.info(
      `SecurePatch backend listening on port ${env.port}${env.demoMode ? " (local synthetic demo mode)" : ""}`
    );
  });

  const shutdown = async (signal) => {
    logger.info(`${signal} received. Shutting down...`);

    server.close(async () => {
      process.exit(0);
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
};

startServer();

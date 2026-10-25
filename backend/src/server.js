require("dotenv").config({ quiet: true });

const dns = require("node:dns");
const dnsServers = (process.env.MONGODB_DNS_SERVERS || "")
  .split(",")
  .map((server) => server.trim())
  .filter(Boolean);

if (dnsServers.length) dns.setServers(dnsServers);

const app = require("./app");
const env = require("./config/env");
const connectDatabase = require("./config/database");
const logger = require("./config/logger");

const http = require("http");

const startServer = async () => {
  if (!env.demoMode) await connectDatabase();

  const servers = [];
  const shutdown = async (signal) => {
    logger.info(`${signal} received. Shutting down...`);
    for (const s of servers) {
      try { s.close(); } catch {}
    }
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  if (process.env.HOST) {
    const server = http.createServer(app).listen(env.port, process.env.HOST, () => {
      logger.info(`AVPR-Net backend listening on ${process.env.HOST}:${env.port}`);
    });
    servers.push(server);
  } else {
    // On macOS, Apple AirPlay Receiver binds to *:5000 (wildcard) on IPv6 and IPv4.
    // In BSD/Darwin sockets, specific IP binds (127.0.0.1 and ::1) take precedence over *.
    // Binding to both IPv4 and IPv6 loopback ensures all localhost traffic routes to Node.
    const s4 = http.createServer(app).listen(env.port, "127.0.0.1", () => {
      logger.info(`AVPR-Net backend listening on 127.0.0.1:${env.port}`);
    });
    servers.push(s4);

    try {
      const s6 = http.createServer(app).listen(env.port, "::1", () => {
        logger.info(`AVPR-Net backend listening on [::1]:${env.port}`);
      });
      s6.on("error", (err) => logger.warn(`IPv6 loopback listener not available: ${err.message}`));
      servers.push(s6);
    } catch (err) {
      logger.warn(`Could not start IPv6 listener: ${err.message}`);
    }
  }
};

startServer();

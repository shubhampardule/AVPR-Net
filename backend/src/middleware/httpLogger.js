const morgan = require("morgan");
const logger = require("../config/logger");
const { redact } = require("../services/ai-safety");

morgan.token("safe-path", (req) => redact(req.path));
morgan.token("request-id", (req) => req.requestId || "unknown");
const httpLogger = morgan(":method :safe-path :status :response-time ms requestId=:request-id", {
  stream: {
    write: (message) => {
      logger.info(message.trim());
    },
  },
});

module.exports = httpLogger;

const logger = require("../config/logger");

const errorHandler = (err, req, res, next) => {
  const parserError = err.type === "entity.parse.failed" || err.type === "entity.too.large";
  const statusCode = parserError ? (err.type === "entity.too.large" ? 413 : 400) : err.statusCode || 500;
  const code = parserError ? (statusCode === 413 ? "REQUEST_TOO_LARGE" : "INVALID_JSON") : err.code || "INTERNAL_SERVER_ERROR";

  // Parser errors can echo input, and upstream errors may contain credentials.
  const diagnostic = parserError
    ? ""
    : ` cause=${err.name || "Error"} code=${err.code || "unknown"} message=${String(err.message || "unknown")
        .replace(/mongodb(?:\+srv)?:\/\/\S+/gi, "[redacted MongoDB URI]")
        .slice(0, 240)}`;
  logger.error(`${code} status=${statusCode} requestId=${req.requestId || "unknown"}${diagnostic}`);

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message:
        parserError ? "Request must be valid JSON within the size limit" : statusCode >= 500
          ? "Internal server error"
          : err.message,
    },
  });
};

module.exports = errorHandler;

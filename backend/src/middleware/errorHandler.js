const logger = require("../config/logger");
const { fromOctokitError } = require("../utils/github-rate-limit");

const errorHandler = (err, req, res, next) => {
  err = fromOctokitError(err) || err;
  if (err.code === 11000) {
    err.statusCode = 409;
    err.code = "RESOURCE_CONFLICT";
    err.message = "This resource already exists or a scan is already active.";
  }
  if (err.name === "CastError" || err.name === "ValidationError") {
    err.statusCode = 400; err.code = "INVALID_INPUT"; err.message = "Invalid request values";
  }
  const parserError = err.type === "entity.parse.failed" || err.type === "entity.too.large";
  const statusCode = parserError ? (err.type === "entity.too.large" ? 413 : 400) : err.statusCode || 500;
  const code = parserError ? (statusCode === 413 ? "REQUEST_TOO_LARGE" : "INVALID_JSON") : err.code || "INTERNAL_SERVER_ERROR";

  // Parser errors can echo input, and upstream errors may contain credentials.
  const diagnostic = parserError
    ? ""
    : ` cause=${err.name || "Error"} code=${err.code || "unknown"} message=${require("../services/ai-safety").redact(String(err.message || "unknown"))
        .replace(/mongodb(?:\+srv)?:\/\/\S+/gi, "[redacted MongoDB URI]")
        .slice(0, 240)}`;
  logger.error(`${code} status=${statusCode} requestId=${req.requestId || "unknown"}${diagnostic}`);
  if (statusCode >= 500 || err.name === "NvidiaError") {
    void require("../services/operations.service").recordSignal(err.name === "NvidiaError" ? "provider_failure" : "request_failure");
  }

  if (Number.isSafeInteger(err.retryAfterSeconds) && err.retryAfterSeconds > 0) {
    res.set("Retry-After", String(err.retryAfterSeconds));
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message:
        parserError ? "Request must be valid JSON within the size limit" : statusCode >= 500
          ? "Internal server error"
          : err.message,
      ...(Number.isSafeInteger(err.retryAfterSeconds) && err.retryAfterSeconds > 0
        ? { retryAfterSeconds: err.retryAfterSeconds }
        : {}),
    },
  });
};

module.exports = errorHandler;

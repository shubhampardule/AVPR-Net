const DEFAULT_RETRY_SECONDS = 60;

function getHeader(headers, name) {
  if (!headers) return null;
  if (typeof headers.get === "function") return headers.get(name);
  const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
  return key ? String(headers[key]) : null;
}

function positiveInteger(value) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function rateLimitError({ status, headers, message = "" }) {
  if (![403, 429].includes(Number(status))) return null;

  const remaining = getHeader(headers, "x-ratelimit-remaining");
  const retryAfter = positiveInteger(getHeader(headers, "retry-after"));
  const isRateLimited = Number(status) === 429 || remaining === "0" || retryAfter !== null ||
    /rate limit|abuse detection/i.test(message);
  if (!isRateLimited) return null;

  const resetAt = remaining === "0" ? positiveInteger(getHeader(headers, "x-ratelimit-reset")) : null;
  const resetDelay = resetAt ? Math.max(1, Math.ceil(resetAt - Date.now() / 1000)) : null;
  const retryAfterSeconds = retryAfter || resetDelay || DEFAULT_RETRY_SECONDS;
  return Object.assign(new Error(`GitHub is rate limiting requests. Wait ${retryAfterSeconds} seconds before trying again.`), {
    statusCode: 429,
    code: "GITHUB_RATE_LIMITED",
    retryAfterSeconds,
  });
}

function fromOctokitError(error) {
  const headers = error?.response?.headers;
  const requestUrl = error?.request?.url || "";
  const isGitHubResponse = getHeader(headers, "x-github-request-id") || /(?:^|\/)api\.github\.com(?:\/|$)/i.test(requestUrl);
  if (!isGitHubResponse) return null;
  return rateLimitError({
    status: error.status || error.response?.status,
    headers,
    message: error.response?.data?.message || error.message || "",
  });
}

module.exports = { fromOctokitError, fromResponse: rateLimitError };

const { fromOctokitError } = require("../src/utils/github-rate-limit");
const errorHandler = require("../src/middleware/errorHandler");

jest.mock("../src/config/logger", () => ({ error: jest.fn() }));

function response() {
  return {
    headers: {},
    status: jest.fn(function (status) { this.statusCode = status; return this; }),
    set: jest.fn(function (name, value) { this.headers[name] = value; return this; }),
    json: jest.fn(function (body) { this.body = body; return this; }),
  };
}

test("primary GitHub rate limits become a retryable 429 with the reset delay", () => {
  const reset = Math.floor(Date.now() / 1000) + 90;
  const error = Object.assign(new Error("API rate limit exceeded"), {
    status: 403,
    response: { headers: {
      "x-github-request-id": "ABC:123",
      "x-ratelimit-remaining": "0",
      "x-ratelimit-reset": String(reset),
    }, data: { message: "API rate limit exceeded" } },
  });

  const normalized = fromOctokitError(error);

  expect(normalized).toMatchObject({ statusCode: 429, code: "GITHUB_RATE_LIMITED" });
  expect(normalized.retryAfterSeconds).toBeGreaterThan(0);
  expect(normalized.retryAfterSeconds).toBeLessThanOrEqual(90);
});

test("secondary GitHub rate limits honor Retry-After without exposing upstream details", () => {
  const error = Object.assign(new Error("secondary rate limit; request data omitted"), {
    status: 429,
    response: { headers: { "x-github-request-id": "ABC:456", "retry-after": "17" },
      data: { message: "You have exceeded a secondary rate limit." } },
  });
  const res = response();

  errorHandler(error, { requestId: "request-1" }, res, jest.fn());

  expect(res.status).toHaveBeenCalledWith(429);
  expect(res.headers["Retry-After"]).toBe("17");
  expect(res.body.error).toEqual({
    code: "GITHUB_RATE_LIMITED",
    message: "GitHub is rate limiting requests. Wait 17 seconds before trying again.",
    retryAfterSeconds: 17,
  });
  expect(JSON.stringify(res.body)).not.toContain("request data omitted");
});

test("ordinary GitHub permission errors are not mislabeled as rate limits", () => {
  const error = Object.assign(new Error("Resource not accessible by integration"), {
    status: 403,
    response: { headers: { "x-github-request-id": "ABC:789", "x-ratelimit-remaining": "4999" },
      data: { message: "Resource not accessible by integration" } },
  });

  expect(fromOctokitError(error)).toBeNull();
});

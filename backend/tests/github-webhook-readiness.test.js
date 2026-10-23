jest.mock("../src/config/github", () => ({ githubApp: { octokit: { request: jest.fn() } } }));
const { githubApp } = require("../src/config/github");
const { getWebhookReadiness } = require("../src/services/github-webhook-readiness.service");
const original = { ...process.env };
const url = "https://app.example.test/api/v1/webhooks/github";
beforeEach(() => {
  jest.resetAllMocks();
  process.env.GITHUB_WEBHOOK_SECRET = "fixture-readiness-secret";
  process.env.FRONTEND_URL = "https://app.example.test";
  delete process.env.GITHUB_WEBHOOK_URL;
});
afterAll(() => { process.env = original; });
function remote(hook = {}, events = ["push", "pull_request"]) {
  githubApp.octokit.request.mockImplementation(async route => ({ data: route === "GET /app" ? { events }
    : { url, content_type: "json", insecure_ssl: "0", secret: "********", ...hook } }));
}

test("a missing local secret does not query GitHub or enable events", async () => {
  delete process.env.GITHUB_WEBHOOK_SECRET;
  expect(await getWebhookReadiness({ force: true })).toMatchObject({ push: false, pullRequest: false });
  expect(githubApp.octokit.request).not.toHaveBeenCalled();
});

test("a private HTTP callback origin cannot be reported as a public GitHub receiver", async () => {
  process.env.FRONTEND_URL = "http://localhost:5174";
  expect(await getWebhookReadiness({ force: true })).toMatchObject({ issue: "WEBHOOK_PUBLIC_URL_MISSING" });
  expect(githubApp.octokit.request).not.toHaveBeenCalled();
});

test.each([{ url: "https://wrong.example.test/webhook" }, { content_type: "form" }, { insecure_ssl: "1" }, { secret: "" }])(
  "local credentials cannot override remote webhook mismatch %j", async hook => {
    remote(hook);
    expect(await getWebhookReadiness({ force: true })).toEqual({ push: false, pullRequest: false, issue: "WEBHOOK_REMOTE_CONFIGURATION_MISMATCH" });
  });

test("missing subscriptions keep both event triggers disabled", async () => {
  remote({}, []);
  expect(await getWebhookReadiness({ force: true })).toEqual({ push: false, pullRequest: false, issue: "WEBHOOK_SUBSCRIPTION_MISSING" });
});

test("readiness is reported independently for each subscribed event", async () => {
  remote({}, ["push"]);
  expect(await getWebhookReadiness({ force: true })).toEqual({ push: true, pullRequest: false, issue: "WEBHOOK_SUBSCRIPTION_MISSING" });
});

test("verified configuration is briefly cached without retaining remote secrets in the result", async () => {
  remote();
  const result = await getWebhookReadiness({ force: true });
  expect(result).toEqual({ push: true, pullRequest: true, issue: null });
  expect(await getWebhookReadiness()).toBe(result);
  expect(githubApp.octokit.request).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(result)).not.toContain("********");
});

test("provider failure fails closed with no raw upstream details", async () => {
  githubApp.octokit.request.mockRejectedValue(new Error("private provider detail"));
  expect(await getWebhookReadiness({ force: true })).toEqual({ push: false, pullRequest: false, issue: "WEBHOOK_CONFIGURATION_UNVERIFIED" });
});

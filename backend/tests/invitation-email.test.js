const service = require("../src/services/invitation-email.service");
const input = { email: "invitee@example.test", url: "https://securepatch.example/invite/accept?token=secret-link",
  role: "developer", expiresAt: "2026-11-01T00:00:00Z", tokenHash: "hash-only" };
const originalFetch = global.fetch;
const originalEnv = { ...process.env };
beforeEach(() => {
  process.env.INVITATION_EMAIL_ENABLED = "true";
  process.env.RESEND_API_KEY = "unit-test-key";
  process.env.INVITATION_EMAIL_FROM = "AVPR-Net <invites@example.test>";
  global.fetch = jest.fn();
});
afterEach(() => { global.fetch = originalFetch; process.env = { ...originalEnv }; });

test("manual mode never contacts a provider even if credentials exist", async () => {
  process.env.INVITATION_EMAIL_ENABLED = "false";
  expect(await service.send(input)).toEqual({ status: "not_configured" });
  expect(global.fetch).not.toHaveBeenCalled();
});
test("uses a token-hash idempotency key and reports acceptance rather than delivery", async () => {
  global.fetch.mockResolvedValue({ ok: true, json: async () => ({ id: "email-id" }) });
  expect(await service.send(input)).toEqual({ status: "accepted", providerId: "email-id" });
  const [url, options] = global.fetch.mock.calls[0];
  expect(url).toBe("https://api.resend.com/emails");
  expect(options.headers["Idempotency-Key"]).toBe("invitation/hash-only");
  expect(options.redirect).toBe("error");
  expect(JSON.parse(options.body)).toMatchObject({ to: [input.email], text: expect.stringContaining(input.url) });
});
test.each(["http://localhost/invite", "https://user:password@example.test/invite", "invalid"])("refuses unsafe invitation URL %s", async url => {
  expect((await service.send({ ...input, url })).status).toBe("failed");
  expect(global.fetch).not.toHaveBeenCalled();
});
test("rate limits have safe codes and provider error text is never returned", async () => {
  const cancel = jest.fn();
  global.fetch.mockResolvedValue({ ok: false, status: 429, body: { cancel } });
  expect(await service.send(input)).toEqual({ status: "failed", code: "PROVIDER_RATE_LIMIT" });
  expect(cancel).toHaveBeenCalled();
  expect(global.fetch).toHaveBeenCalledTimes(1);
});
test("timeouts and malformed acceptance responses remain unknown without an automatic resend", async () => {
  global.fetch.mockRejectedValue(new Error("private provider contents"));
  expect(await service.send(input)).toEqual({ status: "unknown", code: "PROVIDER_UNCONFIRMED" });
  global.fetch.mockResolvedValue({ ok: true, json: async () => ({}) });
  expect(await service.send(input)).toEqual({ status: "unknown", code: "INVALID_PROVIDER_RESPONSE" });
});

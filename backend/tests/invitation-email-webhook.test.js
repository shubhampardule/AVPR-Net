jest.mock("../src/models/OrganizationInvitation", () => ({ updateOne: jest.fn() }));
const crypto = require("node:crypto");
const { Webhook } = require("standardwebhooks");
const Invitation = require("../src/models/OrganizationInvitation");
const { receive } = require("../src/services/invitation-email-webhook.service");
const secret = `whsec_${crypto.randomBytes(32).toString("base64")}`;
const previous = process.env.RESEND_WEBHOOK_SECRET;
const attempt = "a".repeat(64);
const payload = type => JSON.stringify({ type, created_at: new Date().toISOString(), data: { tags: { invitation_attempt: attempt } } });
const sign = (body, date = new Date()) => ({ "svix-id": "msg_fixture", "svix-timestamp": String(Math.floor(date.getTime() / 1000)),
  "svix-signature": new Webhook(secret).sign("msg_fixture", date, body) });
beforeEach(() => { jest.clearAllMocks(); process.env.RESEND_WEBHOOK_SECRET = secret; });
afterAll(() => { if (previous === undefined) delete process.env.RESEND_WEBHOOK_SECRET; else process.env.RESEND_WEBHOOK_SECRET = previous; });

test("unconfigured callbacks fail closed without a database write", async () => {
  delete process.env.RESEND_WEBHOOK_SECRET;
  await expect(receive(Buffer.from("{}"), {})).rejects.toMatchObject({ statusCode: 503 });
  expect(Invitation.updateOne).not.toHaveBeenCalled();
});

test.each(["tampered", "old", "future", "parsed"])("rejects %s callbacks before touching invitations", async kind => {
  const text = payload("email.delivered");
  const date = new Date(Date.now() + (kind === "old" ? -600000 : kind === "future" ? 600000 : 0));
  const body = kind === "parsed" ? JSON.parse(text) : Buffer.from(kind === "tampered" ? `${text} ` : text);
  await expect(receive(body, sign(text, date))).rejects.toMatchObject({ statusCode: 401, code: "EMAIL_WEBHOOK_SIGNATURE" });
  expect(Invitation.updateOne).not.toHaveBeenCalled();
});

test("delivered callbacks match only the current pending attempt and lower delivery states", async () => {
  const text = payload("email.delivered");
  await receive(Buffer.from(text), sign(text));
  expect(Invitation.updateOne).toHaveBeenCalledWith({ emailAttemptHash: attempt, status: "pending",
    emailStatus: { $in: ["manual", "unknown", "accepted", "delayed"] } },
  { $set: { emailStatus: "delivered" }, $max: { emailStatusAt: expect.any(Date) } });
});

test.each(["email.opened", "email.clicked", "contact.created"])("ignores unrelated signed event %s", async type => {
  const text = payload(type);
  await receive(Buffer.from(text), sign(text));
  expect(Invitation.updateOne).not.toHaveBeenCalled();
});

test("bounce and complaint handling cannot regress to a successful delivery", async () => {
  const text = payload("email.delivered");
  await receive(Buffer.from(text), sign(text));
  const allowed = Invitation.updateOne.mock.calls[0][0].emailStatus.$in;
  expect(allowed).not.toContain("bounced"); expect(allowed).not.toContain("complained"); expect(allowed).not.toContain("failed");
});

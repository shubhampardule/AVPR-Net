// Sending is explicit per invitation. Provider acceptance is not inbox delivery.
function available() {
  return process.env.INVITATION_EMAIL_ENABLED === "true" && Boolean(process.env.RESEND_API_KEY?.trim()) &&
    Boolean(process.env.INVITATION_EMAIL_FROM?.trim());
}

async function send({ email, url, role, expiresAt, tokenHash }) {
  if (!available()) return { status: "not_configured" };
  let target;
  try { target = new URL(url); } catch { return { status: "failed", code: "INVALID_LINK" }; }
  if (target.protocol !== "https:" || target.username || target.password) {
    return { status: "failed", code: "HTTPS_REQUIRED" };
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}`, "Content-Type": "application/json",
        "Idempotency-Key": `invitation/${tokenHash}` },
      body: JSON.stringify({ from: process.env.INVITATION_EMAIL_FROM.trim(), to: [email],
        subject: "Your AVPR-Net workspace invitation",
        text: `You have been invited to a AVPR-Net workspace as ${role}.\n\nSign in with ${email} to accept:\n${url}\n\nThis single-use link expires ${new Date(expiresAt).toISOString()}. If you did not expect this invitation, ignore this email.` }),
    });
    // Never include raw provider errors, response bodies, recipient, or token in logs.
    if (!response.ok) {
      await response.body?.cancel();
      return { status: "failed", code: response.status === 429 ? "PROVIDER_RATE_LIMIT" : "PROVIDER_REJECTED" };
    }
    const data = await response.json();
    if (typeof data.id !== "string" || !/^[a-zA-Z0-9-]{1,128}$/.test(data.id)) return { status: "unknown", code: "INVALID_PROVIDER_RESPONSE" };
    return { status: "accepted", providerId: data.id };
  } catch {
    // A timeout can occur after acceptance. Do not claim failure or auto-resend.
    return { status: "unknown", code: "PROVIDER_UNCONFIRMED" };
  }
}

module.exports = { available, send };

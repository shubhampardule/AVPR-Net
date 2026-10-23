# Optional invitation email delivery

Status: transport and signed delivery callbacks implemented locally. Verified sender
configuration, actual inbox receipt, and live provider callbacks remain unverified.
Manual invitation links remain the default; nothing sends automatically.

## Configuration

Set backend-only `INVITATION_EMAIL_ENABLED=true`, `RESEND_API_KEY`, and
`INVITATION_EMAIL_FROM` after configuring a verified Resend sending domain. A member
must explicitly select email delivery for each invitation. Keep all credentials out
of `VITE_` variables. A timeout reports an unknown outcome instead of automatically
resending; the current manual link remains available.

`FRONTEND_URL` must be the public HTTPS application origin. Only owners/admins can
request a send, and only owners can invite an admin. The provider receives the
address, sender, role, invitation URL, and expiry. The plaintext link is necessary
in the email but is not persisted to MongoDB, audit events, or application logs.
The fixed HTTPS endpoint refuses redirects and has a ten-second deadline. A token
digest is also its provider idempotency key. Refresh uses a conditional pending-state
update and a one-minute email cooldown; it rotates the token and invalidates the old
link. There is no background outbox or automatic retry. A status-recording failure
is flagged on the creation response, while the manual link remains available.

Configure a Resend webhook endpoint at
`https://<deployment-domain>/api/v1/webhooks/resend`, with these events:
`email.sent`, `email.delivery_delayed`, `email.delivered`, `email.failed`,
`email.bounced`, `email.complained`, and `email.suppressed`. Store its signing secret
as backend-only `RESEND_WEBHOOK_SECRET`. The endpoint fails closed when this secret
is absent. These are setup instructions; no provider endpoint or key was created.

The endpoint verifies the unmodified request body and Svix headers with the pinned
Standard Webhooks library, including its five-minute timestamp tolerance. Payloads
are capped at 128 KiB. Raw provider bodies, addresses, invitation links and signing
secrets are not logged or stored by the callback handler.

References: [Resend signature verification](https://resend.com/docs/webhooks/verify-webhooks-requests),
[event meanings](https://resend.com/docs/webhooks/event-types),
[delivery payload](https://resend.com/docs/webhooks/emails/delivered), and
[tags in callbacks](https://resend.com/changelog/tags-for-batch-and-scheduled-emails).

## Correlation and state

Each explicit send includes an opaque attempt digest in a Resend tag. Only the
current pending invitation with that digest can receive updates. Refreshing a link,
switching to manual sharing, acceptance, or revocation prevents an older attempt
from changing current delivery state. The digest is private model metadata and is
omitted from invitation APIs and organization exports; raw provider message IDs are
not retained.

Outcomes advance conservatively: unknown/manual → provider accepted → delayed →
recipient-server accepted → failed → bounced → complained. Duplicate and lower-ranked
callbacks cannot change the record. In particular, a late success cannot erase a
bounce or complaint. This is a safety-oriented status policy, not a reconstruction
of every provider event. The provider acknowledgement also cannot overwrite a
callback that arrived before the send response was recorded.

“Delivered” means the recipient's mail server accepted the message; it does not
prove inbox placement, reading, or invitation acceptance. Settings uses that precise
label, shows delay/failure guidance, and advises against resending after a complaint.
The application does not auto-resend, subscribe recipients, track opens/clicks, or
send scan notifications by email.

## Verification

Unit tests reject missing secrets, parsed/tampered bodies, expired/future signatures,
and unrelated events. Signed synthetic HTTP callbacks against disposable Atlas
fixtures verify adverse-state preservation, stale-attempt isolation, and protection
of accepted invitation records. No real recipient is contacted by those tests.
Production readiness still requires a verified sender, actual receipt, provider
dashboard subscriptions, live signed callbacks, and an operational support policy.

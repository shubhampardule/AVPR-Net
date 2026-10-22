# Optional invitation email

Status: implemented locally and tested with mocked provider responses. No real email was sent during development. Verified sender configuration, live receipt, bounce/delivery callbacks, and production acceptance remain open under R08.

Manual invitation links remain the default. To enable the optional Resend adapter, configure backend-only `INVITATION_EMAIL_ENABLED=true`, `RESEND_API_KEY`, and `INVITATION_EMAIL_FROM` using a sender on a verified domain. `FRONTEND_URL` must be the public HTTPS application origin. Never put these credentials in `VITE_` variables. The adapter uses Resend's fixed HTTPS endpoint and adds no dependency.

An owner/admin explicitly selects **Email this invitation** when creating or refreshing a link. Only owners can invite an admin. Merely configuring a provider or opening Settings does not send mail. Existing link creation, verified-recipient matching, expiry, revocation, and acceptance remain in place. A refresh rotates the token and invalidates the older link.

The provider receives the invited address, configured sender, role, invitation URL, and expiry. The plaintext link is required in the email but is not stored in MongoDB, audit events, or application logs. Only its hash is stored. Plain-text email avoids interpolated HTML. Each token hash has a provider idempotency key. Refreshes use a conditional pending-state update and one-minute email cooldown so concurrent requests cannot revive an accepted invitation or bypass the cooldown.

## Status meanings

| State | Meaning / recovery |
| --- | --- |
| manual | No email requested. Copy the link and share it securely. |
| accepted | Provider accepted the request. This does **not** confirm inbox delivery. |
| failed | Provider rejected the request, configuration changed, or the URL was unsafe. The link remains usable for manual sharing. |
| unknown | Timeout, invalid response, or unfinished send. It may have been accepted. Do not automatically resend; share the link or refresh deliberately after the cooldown. |

The HTTP request has a ten-second deadline, refuses redirects, and never returns raw provider errors. There is no automatic send retry or background outbox. Recreating an invitation is an explicit token rotation, not a promise of retrying the same email. `emailStatus` in the invitation list records the last attempt for the current link; an update failure is also flagged in the creation response. Delivery/bounce webhooks are not implemented, so no UI may label a message delivered.

## Live acceptance still required

Use a disposable invited address controlled by the tester, then check provider acceptance, inbox receipt, exact-email sign-in, expiration, revocation, and refreshing invalidation. Check provider rejection and domain misconfiguration with manual-link recovery. Do not send test invitations to unrelated people. A real send requires an explicit action in the application.

References: [Resend idempotency](https://resend.com/changelog/idempotency-keys) and [official API schema](https://github.com/resend/resend-openapi/blob/main/resend.yaml).

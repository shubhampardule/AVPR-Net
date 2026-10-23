# GitHub event configuration and readiness

Status: handler, selected-event validation and configuration checks implemented
locally. Real signed GitHub delivery, redelivery and production acceptance remain open.

The backend verifies signed push/PR payloads and stores only selected commit refs.
Enabling a trigger now additionally requires a backend signing secret and a
read-only inspection of the GitHub App and its webhook configuration. A local
secret alone no longer enables event controls. The inspection requires:

- An HTTPS receiver matching `GITHUB_WEBHOOK_URL`, or the default
  `https://<FRONTEND_URL-host>/api/v1/webhooks/github`.
- JSON payloads, certificate verification enabled, and a configured remote secret.
- A corresponding `push` or `pull_request` subscription for each requested trigger.

`GITHUB_WEBHOOK_URL` is an optional backend-only override when the browser origin
differs from the public receiver. Local HTTP callback addresses cannot receive
public GitHub deliveries. Each read has an eight-second request timeout; a
15-second process-local cache bounds repeated checks. Missing/failed configuration
checks fail closed with fixed reason codes. No private configuration payload or
credential value is returned to the browser.

The UI enables each subscribed event independently. An existing checked trigger
can always be switched off by an authorized manager, even when configuration is
unavailable; scheduled scans remain independent. The API validates event readiness
again before accepting newly enabled triggers.

GitHub masks the remote secret, and this configuration endpoint does not establish
that the local secret matches it or that deliveries are active/successful. Therefore
these checks establish configuration eligibility, not live delivery acceptance.
Before customer use, the owner must configure the same secret in GitHub and the
deployment, enable the webhook, subscribe the events, and verify real signed
delivery and recovery. No secret was generated and no external setting was changed
as part of this follow-up.

Read-only checks on 23 October returned 200 for `GET /app` and 404 for
`GET /app/hook/config`; event readiness correctly remained unavailable. The settings
UI separately showed a blank webhook URL. These observations are not proof of
working event scans.

References: [GitHub App webhook configuration API](https://docs.github.com/en/rest/apps/webhooks#get-a-webhook-configuration-for-an-app)
and [GitHub webhook signature validation](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries).

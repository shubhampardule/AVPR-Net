# In-app notification policy

AVPR-Net notifications are secondary reminders. The scan history and dashboard remain the source of truth.

## First release scope

The first release sends only scan outcome notifications:

- `scan.completed`: at least one scanner ran and every configured scanner completed without an error.
- `scan.partial`: a scan completed with scanner errors or without a successful scanner run. The notice tells the member to review coverage and does not imply a clean result.
- `scan.failed`: the scan did not complete. Cancelled scans do not notify.

Notifications are in-app only. No email or third-party delivery provider is configured.

## Recipients and preferences

Each event is delivered to active members of the scan's organization whose `scanResults` preference is enabled. New members default to enabled; a missing preference on older membership records is treated as enabled. A member can change only their own preference. Removing or suspending a member prevents future delivery; it does not rewrite previously delivered records.

## Deduplication and retention

Delivery is idempotent for each `(recipient, organization, scan, event type)` using a unique database key. Reprocessing a completed or failed worker job cannot add a second copy of the same notice. Notifications expire 90 days after creation through MongoDB TTL cleanup. They contain repository/scan identifiers, finding counts, a safe internal destination, and read state; they do not contain source snippets, provider output, scan errors, invitation links, or credentials.

## Failure behavior

Notification writes are best effort and must not change a scan's terminal status. Write failures log only the event type, scan ID, and error name. Users can still reach the result from scan history and the dashboard; those surfaces are authoritative. The first release has no email fallback or durable notification outbox, so a delivery failure may omit a reminder while leaving the scan result available.

## Deferred events

Installation changes, invitations, membership changes, finding review changes, and AI-policy changes are not notification events in this release. Their audit events remain available in workspace settings. Add new notification types only after recipients, preference controls, deduplication keys, retention, and failure behavior are specified for that event.

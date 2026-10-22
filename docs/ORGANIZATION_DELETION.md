# Organization deletion and primary-data erasure

Status: implemented locally, not deployed or exercised against real organizations.

## Request

An active organization owner can use Workspace settings or `DELETE /api/v1/organizations/:organizationId` with only `{ "confirmation": "Exact organization name" }`. Admins and developers cannot request deletion. The service rechecks the owner membership inside its transaction; stale route authorization is insufficient. Confirmation and the active organization state are checked in the same transaction. Failure rolls back all database changes.

On success (HTTP 202), one transaction:

- Changes the organization to `deleting`, removes its saved GitHub installation ID, and turns off hosted AI.
- Suspends every membership and disables member scan notices. Existing organization and scan access middleware requires an active organization, so old URLs no longer grant access.
- Revokes pending invitation tokens.
- Turns off schedules and webhook-trigger preferences, clears pending commits, and cancels queued/running scan records by clearing their leases and active keys.
- Writes an organization-scoped deletion-request audit event. Audit failure aborts the transaction.
- Sets `purgeAfter` to 24 hours after the request. This is an eligibility time, not a guarantee that erasure finishes at that instant.

The UI requires the exact name and a separate acknowledgement. It recommends exporting first, shows API failures with retry, and navigates to an access-removed/erasure-queued status after acceptance. It does not claim that data has already been erased. The operation cannot be undone from the product.

## Worker erasure

Both the BullMQ worker timer and Vercel polling worker run maintenance approximately every minute while available. Each pass selects at most three due `deleting` organizations, ordered by oldest attempt, and deletes at most 500 records per collection for each. An offline worker leaves erasure pending. Repeated failures are logged with the organization ID and error type; success is not reported for a failed pass.

The settling period allows the bounded scan and hosted-AI work already in flight to expire. A queued scan checks active organization status before claiming work or downloading source. Cancellation prevents active workers from successfully renewing their old lease or finalizing a cancelled scan. Already-issued external requests may still finish; deletion cannot recall them.

Scoped primary records erased in batches:

- Invitations, repository automation, and in-app notifications.
- Organization-tagged assistant result cache entries.
- Findings and their review history, remediation verification records, and scans.
- Audit events and membership records.

The retention service deliberately uses native collection deletion for append-only audit and verification records. This is the narrow organization-erasure exception; normal application updates and deletes remain prohibited by their model hooks. Every native deletion contains both the organization ID and the bounded selected record IDs. Users, other organizations, and their records are never purge targets.

If any scoped collection remains nonempty, the organization remains `deleting`. After all scoped collections are empty, it becomes `deleted` with a completion timestamp. A minimal tombstone retains its ID, deletion timestamps, disabled AI flag, and generic name/ID-derived slug; it prevents stale references from becoming active again. No owner email, repository ID, or source is stored in this tombstone. A subsequent organization can use the old name once the old slug is released at purge completion.

## Retention boundaries and operational requirements

- Legacy assistant cache entries have hashed keys and no organization field. They retain the existing 10-minute expiration/TTL policy; new cache writes include organization IDs. TTL index health and physical expiration must be verified in production.
- Short-lived shared quota buckets and delivery deduplication keys retain their existing expiry policy; they contain counters/IDs, not source or review text.
- The erasure request does not delete personal accounts, repositories, existing proposal branches or pull requests, GitHub App installations, downloaded exports, provider-held requests, operational logs, or database backups.
- No backup-erasure or broad legal-retention guarantee is introduced. Backup/log retention, restore procedures that preserve deletion state, provider deletion obligations, and public policy documents remain explicit roadmap work.
- Replica-set transaction contention, large real deletions, worker interruption/restart, competing writes near deletion, and cross-account denial need live acceptance testing before external onboarding.

## Verification

Service tests mock MongoDB and verify owner rechecks, exact-name predicates, cancellation/disabling writes, failure propagation, purge eligibility, organization scoping, record caps, incomplete batches, and retryable errors. Route tests verify owner-only access and rejection of extra selectors. Worker tests verify that inactive-organization jobs cannot download source or run scanners. Browser tests use mocked APIs to verify confirmation, owner-only visibility, server-error recovery, and the accepted-deletion status.

No production organization or account was deleted in developing this feature.

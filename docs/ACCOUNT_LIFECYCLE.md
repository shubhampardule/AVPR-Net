# Personal account deletion and retained organization records

Status: implemented locally; not deployed. No real user account was deleted during development.

## User workflow

Workspace settings includes a personal-account section even when the user has no organization. Deletion requires the exact signed-in email plus a UI acknowledgement. The API accepts only `confirmation`; it always targets the authenticated user. An owner must transfer every active owner membership before deletion. This also applies when the owned organization is suspended.

`DELETE /api/v1/auth/me` performs one MongoDB transaction:

1. Acquire a write lock on the active User document. Organization creation and invitation acceptance take the same lock before granting memberships.
2. Refuse if any membership still has an active owner role.
3. Suspend all memberships and disable their scan-notification preference. These writes conflict with concurrent ownership transfers on existing memberships.
4. Remove invitation records addressed to the current email and currently stored personal notifications.
5. Remove Mongo session records whose authenticated user, verified GitHub-access metadata, or pending linking flow targets the account.
6. Record `member.account_deleted` in each active organization, within the transaction. Audit failure aborts deletion.
7. Replace the profile with a disabled tombstone: name `Deleted account`, a non-deliverable ID-based email, null image, no Google/GitHub identity or username, and a deletion timestamp.

The tombstone preserves referential integrity and pseudonymous attribution. Passport reads the persisted user on each session request; `requireAuth` refuses its deleted status even if a session is recreated by an already in-flight request. The current session is destroyed and its cookie cleared after commit. A later OAuth sign-in creates a new account ID; prior memberships are not restored.

## What is retained

| Record | Current behavior |
| --- | --- |
| Name, email, avatar, provider links | Replaced/removed from the User profile in the deletion transaction |
| Membership records | Suspended, retained with pseudonymous user ID |
| Scans, findings, review text, remediation verification | Retained by the organization; account deletion does not erase shared evidence or user-authored free text |
| Audit trail | Append-only organization history with pseudonymous actor IDs |
| Invitation records addressed to the account | Removed; invitations authored by this user for other people remain organization records |
| Personal notifications | Existing records removed; in-flight best-effort deliveries can arrive later and expire under the existing 90-day TTL; deleted users cannot access them |
| Authenticated sessions | Matching persisted records removed; deleted status denies further authorized requests |
| Temporary scan source | Uses the existing scan workspace cleanup, unaffected by account deletion |
| GitHub repositories, installations, provider-side data, downloaded exports | Unaffected; uninstall/revoke/delete using the respective provider or file owner |
| Database backups and operational logs | No new automatic backup/log erasure guarantee; production retention and restoration procedures remain an open roadmap item |

Owner-requested organization deletion and primary-data erasure are now implemented locally; see [ORGANIZATION_DELETION.md](ORGANIZATION_DELETION.md). Invitation email delivery and verified backup/log retention remain pending. These limits must be resolved before broad external onboarding. A sole owner can request organization deletion separately; its immediate membership suspension then allows personal-profile deletion. This does not accelerate the queued organization purge.

## Verification

Service tests cover exact confirmation, owner refusal, pseudonymization, session selection, membership suspension, provider unlinking, and propagation of storage/audit failures. Route tests cover authorization, authenticated-user targeting, rejected extra fields, cookie clearing, and failed-deletion responses. Browser journeys cover empty-organization access, confirmation and cancellation, owner refusal, retry, sign-out redirect, and scoped sessionStorage cleanup. Existing organization and invitation tests verify their account-lock calls.

The service tests mock MongoDB. Real replica-set transaction contention, provider callbacks, session invalidation across browsers, and non-owner production deletion remain explicit external acceptance checks. No success claim for those checks follows from the mocked tests.

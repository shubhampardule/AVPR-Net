# Audit remediation and feature delivery

This follows [the deep audit](DEEP_AUDIT_2026-10-20.md). These are implementation
changes, not a rewrite of the original assessment or project history.

| Audit | Delivered behavior |
| --- | --- |
| A01 | Schema-valid membership suspension, owner protection, hashed single-use email-bound invitations with transactional acceptance, role-limited invite creation, revoke/list controls, OAuth return-path preservation, and regression tests. |
| A02 | Fatal exit/JSON errors fail closed; no-success orchestration fails; scanner errors and coverage stay visible. |
| A03 | Atomic active-repository lock, shared hourly quota, pinned authorized SHA, bounded streaming archive download/extraction, subprocess deadlines/process-group cleanup, cancellation and expired-job recovery. |
| A04 | Removed hardcoded verification pass claims and unimplemented scanner branding; examples are marked illustrative; docs describe current services. |
| A05–A06 | Server filters and pagination, history selection, context reset/abort guards, scoped remounting and user-visible errors. |
| A07 | Strict scalar positive pagination values and bounded page sizes; enum validation. |
| A08 | Atomic worker claim/lease, heartbeat, cancellation-safe finalization, active-scan and finding uniqueness indexes. |
| A09 | Commit SHA, branch, scanner versions, covered-file manifest hashes and rules hash recorded; tool versions pinned. |
| A10 | Path-case preservation, exact rule identity plus separate evidence correlation keys/provenance, conservative comparison. |
| A11 | Installation repository pagination, explicit truncated-tree errors, bounded regular text files, immutable file links, brief metadata cache. |
| A12 | Organization and owner membership creation in one MongoDB transaction. |
| A13 | Stored dashboard findings survive GitHub listing errors with an integration warning. |
| A14 | Public HTML frame/nosniff/referrer headers, report-only CSP, authenticated API no-store. |
| A15 | Persistent user/org budgets and concurrent leases, overall AI deadline/cancellation, scoped 10-minute finding-analysis cache. |
| A16 | Removed nodemon; refreshed Jest; migrated Tailwind to v4; updated source-map-js; pinned/upgraded Python toolchain. Remaining tool-only exceptions are documented below. |
| A17 | CI for backend/frontend tests, builds, production audits, credential patterns, browser fixtures and actual offline scanner contracts. Readiness/liveness, worker pulse and release revision exposed. |
| A18 | Lazy page loading, 404/error boundary, explicit retries, organization persistence, focus styles/dialog focus trap, keyboard findings and reduced motion. |

## New workflows

- Owner/admin can issue a seven-day email-bound invitation link; only its hash
  is stored, acceptance must use the matching verified OAuth email, and
  membership activation plus token consumption commit in one MongoDB transaction.
  Open invites can be listed and revoked; an email delivery provider remains
  an external setup item.
- Semgrep's twelve original v1 rules now have paired synthetic unsafe/fixed
  regression samples and a published inventory of intent, severity and limits.
  The offline CI contract checks all twelve detections, zero unexpected results
  on the paired fixed samples, and zero findings when the fixture files are
  scanned with their non-source suffixes. This does not claim real-world rates.
- Current unresolved issues are separate from historical dashboard totals.
- Review findings as open, acknowledged, dismissed or manually resolved, with a
  reason and reviewer. Matching acknowledgements/dismissals survive rescans;
  persisting manually resolved issues reopen.
- Compare new/persistent/fixed evidence identities. Fixed is inferred only with
  matching successful tools, rules and covered-file manifests. Changed files,
  edited snippets and older scans can limit inference; no false clean claim.
- Export authorized scans as JSON or SARIF with source and risk provenance.
- Open a finding-specific AI review using the full bounded file at its scanned
  SHA. Download/copy the proposal and validate its exact single-file diff.
- Owner/admin can create a reviewed **draft PR** only when the default branch
  still matches, source mode is preserved, syntax does not fail, and GitHub App
  write permissions have been approved. Nothing updates the default branch.
- Weekly/monthly scans are opt-in and dispatched by the existing cloud worker.
- Signed push/PR webhooks retain a bounded queue of commit SHAs; deliveries are
  deduplicated. Defaults are off. GitHub App webhook configuration is required.
- If GitHub reports that a connected installation no longer exists, the status
  route clears the stale organization binding and cached user authorization,
  reports the revocation, and lets an owner/admin connect a replacement. A
  transient GitHub API failure preserves the existing connection for retry.
- Local credential pattern checks omit matched values. Optional npm lockfile
  v2/v3 advisory checks send package names/versions to OSV only when selected.
  Advisory matches use an explicitly unassessed medium baseline, not invented CVSS.

## Operational limits and external setup

Limits: 20 scan attempts per org/hour; one active scan per repository; 50 MiB
compressed archive, 200 MiB expanded, 20,000 entries, 20 MiB per entry. Each
external scanner has a 120-second deadline; the worker job budget is ten minutes.
Queued records expire after fifteen minutes. AI allows ten requests/user/minute,
100/org/hour and two concurrent requests/user, with a 210-second total deadline.

New GitHub App features require external setup:

1. For PRs, approve repository **Contents: write** and **Pull requests: write**
   for the App and installation. Until approved the API explains the missing
   permission; read-only scanning still works.
2. For events, configure the App webhook URL
   `https://avpr-psi.vercel.app/api/v1/webhooks/github`, a matching server-only
   `GITHUB_WEBHOOK_SECRET`, and push/pull_request subscriptions. Then enable
   events per repository. The URL alone never authorizes an event.
3. Weekly/monthly scheduling needs an active worker and MongoDB, but no external
   cron credentials. Existing schedules are visible with their next run/error.

The worker does not execute arbitrary project test suites. PR descriptions say
tests were not executed; existing trusted repository CI should validate them.
C/C++/Bash syntax remains manual. This is intentional capability disclosure.

## Rule ownership and dependency exceptions

Semgrep uses twelve original versioned baseline rules bundled with this project,
plus Bandit's Python rules and separate credential patterns. This replaces the
changing remote `auto` configuration. Coverage is narrower and explicit; it does
not claim the remote registry's full breadth. Add reviewed project-owned or
appropriately licensed rules and refresh tests/hash when extending coverage.

The Semgrep registry's current rules license restricts distribution/hosted use;
registry rules were not vendored into this service. See
[the provider's license](https://semgrep.dev/legal/rules-license/).

The latest available Semgrep 1.181.0 pins MCP 1.29.0, whose stateful HTTP server
has CVE-2026-59951. This application never runs that server; scanner subprocesses
only perform local static analysis. A compatible upstream release is needed to
remove that dependency exception without overriding its declared constraints.

Jest's development-only chain still carries moderate sprintf-js advisories with
no compatible nonbreaking remediation reported by npm. No runtime dependency
inherits that chain. Do not accept an automatic downgrade to Jest 25 to silence
the report. Frontend full and both production-only npm audits are clean as
measured after these changes; audits must continue to run as advisories change.

## Validation record

The implementation was checked with backend unit/regression tests, frontend
component tests, production builds, real scanner fixtures under an unprivileged
read-only/network-isolated container, an authorized bounded GitHub archive fetch,
and an isolated MongoDB replica set. Mongo checks exercised transaction rollback,
concurrent admission, concurrent leases and unique indexes. Production readiness
was read-only checked for pre-existing duplicate finding keys before deployment.
Raw local evidence is in ignored `backend/.local/audit/`.

CI browser tests use explicit mocked API fixtures, without real OAuth credentials
or provider calls. Real production authentication and integration checks are
separate from those deterministic tests. Do not describe mocked tests as proof
of a live external permission or service.

## Verification refresh (2026-10-21)

After the workflow and assistant-control updates, the local verification suite
passed: backend Jest 31 suites / 256 tests, frontend Vitest 5 files / 12 tests,
Playwright 63 journeys, frontend production build, and `git diff --check`. The
secret-pattern check covered 231 tracked files. The frontend full audit and
both frontend/backend production-only audits reported zero vulnerabilities.
The backend full development audit still reports the previously documented
moderate `sprintf-js` advisory through Jest; there is no compatible fix in the
current dependency chain, and Jest was not downgraded to silence the report.

The live health endpoint was rechecked on revision `911d98f` and reported the
MongoDB database connected and NVIDIA configured. Health configuration does
not prove a provider request by itself; a separate production assistant smoke
request with synthetic sample data succeeded during this verification period.
The currently served production revision predates the latest frontend changes,
so the single-toggle fix is not live until the following deployment completes.
The latest GitHub Actions run for `911d98f` passed. The local Docker engine is
unavailable on this machine, so the scanner-contract container was not rerun
locally during this refresh; its latest CI run on that revision passed.

## GitHub installation revocation follow-up (2026-10-21)

The installation status route now treats GitHub's definitive 404 as a removed
installation, clears the organization binding and the matching cached user
authorization, and returns a recoverable disconnected state. Other GitHub API
errors preserve the binding. The UI removes the revoked installation option,
explains what changed, and allows an owner/admin to select a replacement.
Backend tests cover removed, live, and temporarily unavailable installations;
a browser journey verifies the reconnection flow. After this follow-up the
local run passed 32 backend suites / 259 tests, 5 frontend unit-test files / 12
tests, and 64 Playwright journeys. The production build and frontend plus
production dependency audits passed. At the time of that entry, CI and
production deployment checks were pending; the final result is recorded below.

## Final production and CI verification (2026-10-21)

The CI workflow now pins `actions/checkout`, `actions/setup-node`, and the
failure-only artifact upload action to verified immutable release SHAs. Both
jobs use Ubuntu 24.04 explicitly to avoid changing runner images during the
Ubuntu 26 migration. The final run for `77df690` passed 32 backend suites /
259 tests, 5 frontend test files / 12 tests, the frontend build, production
dependency audits, the tracked-file secret-pattern check, all 64 Playwright
journeys, and the isolated scanner contract. The former Node 20 and
`ubuntu-latest` migration annotations are gone.

Vercel completed the deployment for `77df690`; the production health endpoint
reported that exact revision, a connected MongoDB database, and NVIDIA as
configured (provider reachability is not reported by the health endpoint).
The signed-in production owner workspace reloaded successfully with the two
authorized repositories. The repository-access dialog refreshed access and
confirmed the same list; the assistant appearance toggle switched to light
and back to the original dark setting. No production browser console warnings
or errors were reported.

The backend's full development audit still includes the previously recorded
moderate `sprintf-js` advisory through Jest; npm offers no compatible fix, and
the production-only audits remain clean. A fresh non-owner OAuth and GitHub
App installation journey still requires a separate test account and has not
been represented as verified by the owner-account smoke checks.

## GitHub API rate-limit recovery (2026-10-22)

GitHub primary and secondary rate-limit responses now return a sanitized HTTP
429 with a `Retry-After` header and retry delay in the response body. Primary
limits use `x-ratelimit-reset`; secondary limits honor `Retry-After` and fall
back to GitHub's documented minimum one-minute wait. Archive-download limits
receive the same response. Permission errors remain separate, and the app
does not retry automatically while GitHub is limiting requests.

Deterministic coverage passed for primary and secondary Octokit errors,
permission-error classification, archive-download rate limits, and the
repository-page recovery path after a 429. The backend suite passed 33 suites /
264 tests; frontend unit tests and production build passed, and the Vercel
backend bundle built successfully. Actual quota exhaustion and large-repository
behavior still need an external GitHub installation test; mocked responses do
not prove provider behavior.

## Conservative scan comparison (2026-10-22)

Scan comparisons now assign `new`, `persistent`, and `fixed` labels only when
both scans have successful scanner runs and matching scanner sets, tool
versions, covered-file hashes, rule and scanner-policy hashes, and normalizer
hashes. The scanner-policy hash covers the adapters, orchestration, process
handling, rule file, and deduplication identity policy, so a change to scanner integration
code also invalidates a comparison baseline. When there is no compatible prior
scan, the API returns empty classification lists and the scan page explains
why it cannot make those claims. Historical scans without the new policy hash
remain unclassified until two compatible scans are available.

Finding fingerprints and cross-scan correlation include scanner and rule
identity as well as repository, path, CWE, and location. Reports from separate
scanners remain separate findings even when they point to the same line; each
keeps its own evidence snippet and provenance. Cross-scanner grouping is
deferred until a reviewed benchmark can show it is reliable.

Regression verification passed for matching comparisons, missing baselines,
partial scans, changed scanner sets/versions/file coverage/rules/normalization/
scanner implementation, and the UI's no-baseline state. The full backend suite
passed 270 tests, the frontend suite passed 14 tests, and both production
builds succeeded.

## Deterministic guidance and source-pinned proposals (2026-10-22)

Each newly scanned finding can carry versioned deterministic remediation
guidance for the project's Semgrep rules, selected common Bandit rules,
credential-pattern findings, and npm advisories. Unknown rules remain unmapped.
The finding page labels these fixed rule-based steps separately from AI advice.

AI review proposals now carry an explicit safe relative target path. The model
output must be one strict unified diff for that exact file, and it must apply
without fuzz to source retrieved at the finding's immutable scan commit. Input
and output sizes remain bounded; syntax checking does not execute repository
code, and draft PR creation still rechecks the base SHA and GitHub permissions.

Regression verification passed for all mapped guidance types, persistence from
the worker, UI labeling, source-at-commit retrieval, traversal rejection, and
patch path/context validation. The full backend suite passed 298 tests and the
frontend suite passed 15 tests; both production builds succeeded. All 64
Playwright journeys also passed after updating the scan-comparison fixtures for
the new availability state.

## Dashboard lifecycle and security activity (2026-10-22)

The dashboard now separates historical finding/risk totals from current
unresolved counts. Current findings use each repository's newest completed scan
with at least one scanner and no scanner errors. A later partial, failed, or
running scan leaves the previous complete result visible with a warning.
Connected repositories without a complete baseline are counted and excluded
from current findings, with a link back to repository scanning. Repository
keys are case-normalized and ties use a stable scan ID order.

Added an append-only `AuditEvent` model, owner/admin activity API and settings
panel. Events cover organization creation, scan start/cancel, finding reviews,
GitHub installation connection/revocation, member and invitation changes,
hosted-AI setting changes and consented requests, and draft pull requests.
Metadata is action-specific and excludes source code, invite tokens, emails and
review reasons. Actor IDs are retained with pseudonymous labels and display
names are resolved for current users. Audit persistence failures are logged and
flagged in action responses; workspace settings explains when a change saved
without its activity record.

The organization-wide Findings page now uses the same complete-scan criteria as
the dashboard and reports when its results are retained from an earlier scan
or when repositories have no complete baseline. The API never labels a
repository clean based only on failed or partial scans.

## Remediation verification records (2026-10-22)

Added append-only records for each patch validation and draft PR. Records retain
the organization, finding, pinned commit, target path, actor, SHA-256 digests of
the diff/source/proposed result, and four explicit checks: patch integrity,
syntax, allowed project tests, and security rescan. Source text, full diffs, and
parser diagnostics are not stored. Invalid diffs create a failed integrity
record and mark dependent syntax as skipped. Validation is capped at 60 attempts
per organization per hour.

The assistant review flow reloads and displays recent records. Syntax failures
are visible and block draft PR creation. Project tests and post-patch security
rescans are marked unavailable because repository execution and scanning of
proposal branches are not enabled; these states never count as passes. If a
draft PR is created but MongoDB cannot save its verification record, the
response and interface call out the missing record instead of implying it was
saved.

When a later scan detects a finding that was previously marked resolved, the
worker stores a new open finding tied to the new scan and leaves the old scan's
evidence and review decision intact. Automatic reopening based on post-patch
test or rescan failures remains unavailable until those checks can run in the
isolated runner.

Draft PR safety is now covered directly: only the source file at the scan's
commit can be changed, the default branch must still match that commit, both
GitHub write permissions and explicit review acknowledgement are required, and
creation affects only a new draft branch. A failed PR creation attempts to
delete only that proposal branch.

Verification passed: backend 44 suites / 338 tests, frontend 15 tests, frontend
production build, Vercel backend bundle, and all 69 Playwright journeys. Fresh
non-owner OAuth/GitHub App installation, production Mongo retention/deletion,
and cross-account provider checks remain external beta work.

## Scan notifications (2026-10-22)

Added an in-app notification center for completed, partial, and failed scans.
Active organization members are recipients by default and can change only their
own scan-results preference. Delivery is idempotent per recipient/scan/event;
MongoDB TTL removes notices after 90 days. Notices contain a safe scan link and
bounded summary, not scanner errors or source/provider content. Cancelled scans
do not notify. Notification writes are best effort and cannot change scan
status; scan history remains authoritative. Email and a durable delivery outbox
are deferred and disclosed in the UI and [notification policy](NOTIFICATIONS.md).

The dashboard header exposes unread count, retry on load errors, read state,
preference controls, and navigation to the exact scan. Browser journeys verify
preference persistence, read-all, exact-scan navigation, recovery after a
notification request fails, and the popover layout in a narrow light-mode view.

Verification passed on the combined working tree: backend 46 suites / 350
tests, frontend 15 tests, frontend production build, Vercel backend bundle, and
all 72 Playwright journeys. Provider sign-in and cross-account installation
checks still require a non-owner account; this suite uses deterministic API and
provider fixtures and is not evidence of a live multi-account beta test.

## Organization ownership transfer (2026-10-22)

Added an owner-only transfer flow in workspace settings. The owner selects an
active admin or developer and types the exact organization name. A MongoDB
transaction rechecks the current owner's role, demotes them to admin, and
promotes the selected member; stale owner state or an ineligible target rolls
back the transaction. The new owner and former owner IDs are added to the
append-only activity log. After success, the browser reloads workspace roles so
the former owner's controls immediately reflect admin access.

Backend regression tests cover confirmation checks, current-owner rejection,
transactional filters, audit metadata and owner-only route access. Browser
coverage checks that confirmation is required, then verifies that ownership,
the caller's role, and visible settings controls update after transfer.

Verification passed on the combined working tree: backend 51 suites / 368
tests, frontend 15 tests, frontend production build, Vercel backend bundle, and
all 76 Playwright journeys. Live ownership transfer still needs a non-owner
account and production-like multi-account verification.

## Organization data export (2026-10-22)

Added an owner/admin-only JSON download in workspace settings. The export
contains organization and membership metadata, invitation history, repository
automation settings, scan and finding summaries with review decisions, audit
events, and remediation verification records. Field allowlists omit source
files, dedicated finding evidence snippets, raw scanner stderr, OAuth/session
credentials, provider account IDs, GitHub installation IDs, and invitation
token hashes. Successful exports are recorded as `organization.exported` audit
events. A preflight count and a shared 25,000-record budget reject oversized
exports before returning data; data is never silently truncated.

Verification passed on the combined working tree: backend 51 suites / 368
tests, frontend 15 tests, frontend production build, Vercel backend bundle, and
all 76 Playwright journeys. Export tests cover owner/admin access, field
omissions, the size limit, audit metadata, successful download, and retry after
a size-limit response.

## Member self-service leave (2026-10-22)

Added a self-service leave flow for active admins and developers. They must
confirm the exact organization name; the API suspends only the caller's active
membership in a MongoDB transaction and verifies that an active owner remains.
An owner receives a conflict response directing them to transfer ownership
first. The departure is recorded as `member.left`, and the settings page
refreshes membership context and returns the user to the home page.

Verification passed on the combined working tree: backend 51 suites / 368
tests, frontend 15 tests, frontend production build, Vercel backend bundle, and
all 76 Playwright journeys. Focused checks cover owner protection, active-owner
invariant, self-only route access, exact-name confirmation, and recovery to the
home page.

## Personal account lifecycle — 2026-10-22 (local, not deployed)

Added `DELETE /api/v1/auth/me` and a personal-account deletion form in Workspace settings, including the no-organization state. Exact account email confirmation is required; organization owners must transfer first. A MongoDB transaction suspends memberships, disables their scan notifications, removes addressed invitations and stored notifications/sessions, records membership audit events, and replaces personal profile/provider fields with a disabled pseudonymous tombstone. Organization evidence and review text remain shared records. Organization creation and invitation acceptance take an active-account write lock to serialize against deletion. Ownership transfers contend on membership documents.

The browser flow covers cancellation, invalid confirmation, owner refusal, retry, and the deleted-account sign-in message. Retention boundaries and unverified live concurrency/backup behavior are recorded in [ACCOUNT_LIFECYCLE.md](ACCOUNT_LIFECYCLE.md). No real account was deleted. Organization deletion and production erasure/retention policies remain open in plan.md.

Validation: backend full suite passed 54 suites / 385 tests before the last added inactive-account regression; the affected five backend suites then passed 26 tests. Frontend 15 unit tests, all 78 browser journeys, production Vite build, and backend Vercel bundle pass. Browser provider/API calls and backend storage calls in the new lifecycle tests are mocked.

## Organization deletion — 2026-10-22 (local, not deployed)

Added owner-only `DELETE /api/v1/organizations/:organizationId` and a separately confirmed workspace settings flow. A transaction rechecks the current owner and exact organization name, suspends memberships, disconnects the saved GitHub installation reference, turns off hosted AI and repository automation, revokes invitation tokens, cancels active scan records, and records the deletion request. The UI reports access removal and queued erasure, with recovery on request failure; it never claims that HTTP 202 means data is already erased.

Worker maintenance processes erasure after a 24-hour settling period. Each pass considers at most three due organizations and deletes at most 500 records per scoped collection. Incomplete and failed passes remain pending. The retention service narrowly uses native collection deletion for the append-only audit/verification erasure exception; all deletes include organization ID and selected record IDs. A generic disabled tombstone records completion. Workers skip inactive-organization jobs before source download. New assistant cache entries carry an organization ID for scoped deletion; legacy entries retain their existing expiration policy.

See [ORGANIZATION_DELETION.md](ORGANIZATION_DELETION.md) for retained metadata, external/provider/backup exclusions, worker availability requirements, and unverified live acceptance checks. No real organization was deleted. Backend verification passed 56 suites / 398 tests; focused owner-deletion browser journeys also pass. All 80 browser journeys and 15 frontend unit tests passed, along with the frontend production build and backend Vercel bundle. Lifecycle browser APIs and MongoDB service calls in the new tests are mocked; live erasure remains unverified.


## AVPR-Net branding, invitation email, and operations — 22 October 2026

The current product display name is AVPR-Net. Header/wordmark, accessible home links, route/loading/document titles, sign-in/invitation copy, SARIF tool branding, draft PR descriptions and invitation email text use the new name. Existing session cookies, browser preference keys, rule IDs, API headers and provider URLs are preserved for compatibility. Historical records retain the earlier SecurePatch name where it describes that earlier revision.

Optional invitation email is implemented locally through Resend, disabled by default and requiring explicit per-invitation UI opt-in. Manual links remain usable after rejection or uncertain provider results; acceptance is not labeled inbox delivery. Refreshes enforce pending-state and email cooldown atomically. No real mail was sent. Verified sender setup, delivery/bounce callbacks and live acceptance remain pending. See INVITATION_EMAIL.md.

A read-only operations CLI checks MongoDB, worker heartbeat, queue age, failed/partial scans and fixed-category error counters. Counter writes are bounded and best effort; monitoring output omits account/repository identifiers and raw errors. The configured database/worker passed a read-only check; alert routing, deployed counters and recovery drills remain pending. GitHub GET /app reconfirmed the registered App is read-only with no event subscriptions. See OPERATIONS_RUNBOOK.md.

Offline scanner/correlation evaluation tooling accepts bounded supplied annotations, exact one-to-one finding matching, per-rule precision/recall and duplicate/false-merge/false-split pair counts. Synthetic results are labeled and reviewed-data provenance is attributed rather than authenticated. Independent real-world benchmark data is still missing. Seven schedule/event recovery tests were added. See SCANNER_BENCHMARK.md.

The canonical R01–R17 list records partial completion and external acceptance separately. No item is closed solely because local mocked tests pass.


Final verification for this local release: backend 60 suites / 428 tests pass; the 32 backend checks affected by the final display-name update pass; frontend 6 files / 16 unit tests pass; all 86 browser journeys pass with AVPR-Net branding. Frontend production build and backend Vercel bundle pass. Credential-pattern checks pass for staged application files. Browser and service tests use mocked providers where noted; the separate database/worker and GitHub App observations above were real read-only calls. No email, live deletion, GitHub permission change, external alert provisioning, or production deployment was performed.

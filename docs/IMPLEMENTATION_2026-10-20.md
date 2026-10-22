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
production dependency audits passed. CI and production deployment checks for
this follow-up are pending its push.

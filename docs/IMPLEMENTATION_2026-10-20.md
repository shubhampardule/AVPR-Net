# Audit remediation and feature delivery

This follows [the deep audit](DEEP_AUDIT_2026-10-20.md). These are implementation
changes, not a rewrite of the original assessment or project history.

| Audit | Delivered behavior |
| --- | --- |
| A01 | Schema-valid membership suspension, restoration of existing members, owner protection, team settings UI, and real-model regression tests. |
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

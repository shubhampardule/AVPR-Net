# AVPR-Net / SecurePatch deep audit

Date: 20 October 2026, Asia/Kolkata. Revision: `020d7bf2cbf1fd94e312397abac3516361465eb9`.

Follow-up: [implementation and verification record](IMPLEMENTATION_2026-10-20.md).
The findings below describe the assessed revision, before those fixes.

The deployed application has a working foundation. The next work should improve
access revocation, scan accuracy, bounded resource use, and the connection between
findings and remediation. Adding more landing-page animations would have less value.

## Scope and evidence

- Reviewed authentication, organization/member authorization, GitHub integration,
  scan enqueueing, worker/queue behavior, archive handling, scanner adapters,
  finding normalization/deduplication/risk, AI/RAG, frontend state, deployment and docs.
- Backend regression suite: **174 tests passed, 14 suites**.
- Frontend production build: passed; main bundle **544.84 kB / 156.40 kB gzip**.
- Semgrep 1.181.0 in an isolated container, read-only source mounts, telemetry off:
  `p/default` scanned **106 source files, 25 raw alerts, zero scanner errors**;
  `p/security-audit` scanned 106 files, zero alerts, zero errors. Rule sets differ;
  neither count is a count of confirmed exploitable vulnerabilities.
- Read-only production checks: home/login 200; API health 200; unauthenticated
  user, scan and organization AI endpoints 401. Frontend security headers were
  inspected separately from API headers.
- Current npm audits, including development dependencies: backend **22 package
  warning records** (3 high, 19 moderate), frontend **8** (6 high, 2 moderate).
  Both `--omit=dev` audits: **zero reported vulnerabilities**. Records overlap
  through dependency chains; these are not 30 independent flaws.
- Pattern scan of 167 tracked files found no matching live NVIDIA/GitHub token,
  MongoDB credential URI or private key. A key-shaped string is a deliberate
  redaction test fixture. Environment files remain ignored. This was not a full
  Git-history secret scan and does not prove arbitrary text is secret-free.
- Isolated probes exercised actual application modules with fake I/O. They
  reproduced scanner failure handling, pagination bounds, fingerprint behavior,
  and membership schema rejection. No production memberships, scans or records
  were modified, and no application source was changed for this audit.

Raw evidence: `backend/.local/audit/`. Reproduce local probes from backend with
`node .local/audit/probes.cjs`. Those files are ignored intentionally. Authenticated
browser journeys were not replayed during this audit. Python/container dependency
vulnerability auditing and a network penetration test were outside this pass.

## Fix before expanding the product

### A01 — P1: member removal fails instead of revoking access

**Confirmed by schema validation.** `backend/src/controllers/member.controller.js:209`
sets `membership.status = "inactive"`, then saves. The schema at
`backend/src/models/OrganizationMember.js:25` permits only `active`, `invited`,
and `suspended`. The real model rejects the removal status, so the existing
active membership is not revoked by this operation.

Use a consistent status lifecycle, test the real schema with the controller,
then verify subsequent organization, scan and AI access is rejected. Also handle
re-inviting a previously suspended/removed member: `addMember` currently rejects
every existing membership, regardless of status. Keep owner protections.

### A02 — P1: failed analysis can be reported as completed

**Reproduced with actual modules and synthetic subprocess results.** Both scanner
adapters parse stdout and return `parsed.results || []` before checking fatal
exit status. A Semgrep exit code 2 with valid JSON containing an error was
accepted as a successful zero-finding scan.

There is a second path: the orchestrator distinguishes executable availability
from successful scanning, but only throws if no executable is available.
When every available scanner throws, it returns zero successful scanners.
The real worker then records `completed` and `summary.total = 0`.

Locations: `backend/src/scanners/semgrep.adapter.js:72`,
`backend/src/scanners/bandit.adapter.js:62`,
`backend/src/scanners/orchestrator.js:52`,
`backend/src/workers/scanWorker.js:151`.

Check exit status and structured errors first; distinguish failure, partial
coverage and success. Require at least one successful scanner to complete a
scan. Persist supported-language/file coverage and skipped/error counts. Test
fatal exit plus JSON, malformed JSON, all failures, partial failures and empty
but successful scans. A zero-finding result must never imply full coverage.

### A03 — P1: scans and downloads need enforceable resource budgets

**Confirmed missing controls; no destructive resource test performed.** The scan
endpoint creates a job for each request without a server-side active-job check,
per-user/org quota, or request idempotency key. Disabling a frontend button is
not a server-side limit. Archive downloads are buffered in memory and extracted
without application limits on compressed size, expanded size or file count.
Actual Semgrep/Bandit scan subprocesses lack wall-clock timeouts; only their
version checks have a timeout.

Locations: `backend/src/services/scan.service.js:29`,
`backend/src/services/workspace.service.js:38`, and the `execFile` options in
both scanner adapters. One large/slow repository can monopolize the single
production polling worker. Limit job creation atomically, validate repository
identifiers/access before enqueueing, bound download/extraction, and terminate
the subprocess tree at a documented scan deadline. Add cancellation and stuck-job
recovery. Choose limits from measured repository workloads.

The worker image runs as root and scanner subprocesses inherit the full service
environment. Run as a non-root user and provide scanners a minimal environment;
this reduces the impact of a scanner/parser flaw. No scanner RCE was demonstrated.

### A04 — P1 for a judged demo: align product claims with implemented behavior

The homepage advertises verified patches, Docker test execution, zero-regression
patches and weekly/monthly monitoring. The backend currently provides manual
scanning and advisory code/diff proposals; it does not implement a scheduler,
automatic patch verification or PR creation.

Examples: `frontend/src/components/hero/HeroSection.jsx:32`,
`frontend/src/components/narrative/ScrollNarrative.jsx:44`,
`frontend/src/components/narrative/StageVerify.jsx:22`,
`frontend/src/components/capabilities/ArchitectureGrid.jsx:84`.

Label these visual examples as planned capabilities or replace the claims with
the working scan → prioritize → explain → review flow. README/submission docs
also contain stale statements about in-memory sessions, missing credentials and
unverified deployment. Update them to describe Mongo sessions and Vercel Queues.
Use one consistent product name and add the production link and a factual demo path.

## Correctness and reliability

| ID | Priority | Finding and evidence | Change |
| --- | --- | --- | --- |
| A05 | P2 | `ScanPage.jsx:72` fetches only `limit=100`, ignores pagination, and filters that subset locally. Findings beyond the first 100 cannot be inspected there; a filter may incorrectly appear empty. | Add server-side filtering, pagination, total counts and stable ordering. |
| A06 | P2 | `ScanPage.jsx:58` selects the first history item only when `!activeScan`. Organization/repository changes do not clear active scan, findings or pending responses. | Reset context-bound state, abort old fetches and polling, and reject stale responses. Render a history selector; `scanHistory` is populated but not presented as a usable list. |
| A07 | P2 | `scan.service.js:94` accepts zero, huge and malformed limits. Probe: `limit=0` reaches the query unchanged and produces a non-finite page count; `1000000` is accepted. | Validate scalar positive integers, cap page size and offsets, validate filter enums, and return 400 for invalid input. MongoDB limit zero removes the result limit. |
| A08 | P2 | Worker reads the scan and separately marks it running. It skips only completed jobs; no atomic claim/lease prevents two deliveries processing the same scan. Finding `{scan,fingerprint}` index is not unique. | Atomically claim jobs with a lease and heartbeat, enforce a unique finding key, and test concurrent delivery/recovery. Distinguish queued, retrying and terminal failure states. |
| A09 | P2 | Workspaces and file trees use moving `HEAD`. Scan records contain no commit SHA, scanner versions or ruleset identity. The worker installs unpinned Python tools and Semgrep uses `--config auto`. | Resolve an immutable SHA at enqueue time, use it for the archive/file links, and save versions, rule identity, branch/ref and coverage. Pin tool versions and approved rules. |
| A10 | P2 | `deduplicator.service.js:16` lowercases paths. Probe: distinct Linux files `src/Auth.js` and `src/auth.js` collapse to one finding. Including scanner-specific `ruleId` also prevents ordinary cross-scanner correlation. | Preserve path case; separate scanner-specific identity from an explicit correlated issue identity. Preserve all evidence and scanner provenance. Test line shifts before using fingerprints for longitudinal resolution. |
| A11 | P2 | `github.service.js:9` requests only one installation repository page. Recursive tree `truncated` is ignored; file content assumes every response contains base64 text. | Paginate repositories, surface/fetch truncated trees, bound file sizes, handle binary and unsupported content encodings, and cache metadata briefly. Test large installations and repositories. |
| A12 | P2 | Organization creation writes organization and owner membership separately. A second-write failure can leave an ownerless organization with an occupied slug. | Use a transaction and handle concurrent slug conflicts explicitly. Add a failure-path test. |
| A13 | P2 | The dashboard overview awaits live GitHub repository listing after loading local scan data. An installation/API failure can fail the entire overview. | Return stored scan/finding data with a separate integration warning and stale repository count. |

Dashboard totals are explicitly labeled historical, so counting old findings is
not a defect by itself. Add a separate **current unresolved issues** view based on
the latest successful scan per repository. Do not silently redefine historical
counts. An issue absent from a partial/failed scan should not be marked resolved.

## Security and operational improvements

### A14 — P2: frontend responses lack the API's browser security headers

Live `/` and `/login` responses had no CSP, frame restrictions or `nosniff` header.
Those headers exist on Express responses, but Vite HTML is served by a separate
Vercel service. Add appropriate headers to frontend/public routing and verify
them on deployed HTML. Start a CSP in report-only mode and account for actual
assets/fonts/avatar origins before enforcing it. Set authenticated API responses
to `Cache-Control: no-store` explicitly. This audit did not demonstrate cached
private data exposure or XSS.

### A15 — P2: budgets must survive serverless scaling

AI counters and concurrency limits live in a module-local Map in
`backend/src/routes/assistant.routes.js:14`. A new instance has fresh counters;
multiple instances each accept requests. This is useful local throttling but
not an account-wide cost ceiling. Persist atomic per-user/org usage budgets
using existing infrastructure. Bound the whole workflow, not just individual
provider attempts, and propagate cancellation where possible. Expose retryable
failure reasons and a retry action without weakening schema/citation validation.
Cache repeated authorized finding explanations by org, evidence/commit hash,
model, prompt version and corpus version.

The last recorded live suite passed 8/9 structured cases, with the failed C case
passing a separate rerun. That is useful evidence, not a reliability guarantee.
Keep broader fixtures and preserve failure reports. Do not auto-apply a proposal
because syntax passed, and keep C/C++/Bash/diff validation limitations visible.

### A16 — P2: development dependencies also require maintenance

The current npm warnings are in dev/build chains, not the production-only graphs.
Root advisories include [braces recursion](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm),
[sprintf-js precision handling](https://github.com/advisories/GHSA-hp3w-g68c-fv3c),
[PostCSS selector parsing](https://github.com/advisories/GHSA-rj75-hqrm-r3gf), and
[source-map-js indexed maps](https://github.com/advisories/GHSA-68fv-2mgg-jv7q).
Do not run `npm audit fix --force` blindly: suggested paths include major
Tailwind migration and Jest/nodemon downgrades. Upgrade compatible fixed
transitives where available; assess and document remaining tool-only exposure,
then test any intentional tool migration. Audit Python/image dependencies too.

### A17 — P2: deployment checks need automation

There is no `.github/workflows` directory, frontend test script, or automated
browser journey suite. The passing backend tests did not catch the member
removal or scanner success/failure contract defects reproduced above. Add CI for
backend tests, frontend build, audits, adapter/worker integration tests and secret
checks. Add a small staging browser suite: login, org creation, installation,
scan, failed/partial scan, pagination, organization switching and access revocation.
Keep mocked deterministic tests separate from opt-in paid provider evaluation.

Expose liveness, dependency readiness, worker heartbeat/last successful job, queue
age and deployment revision separately. The current public health check is not
proof the queue/scanner worker is healthy. Alert on stuck scans and scanner-wide
failure, using sanitized structured logs with scan/job/request IDs.

### A18 — P3: frontend polish that improves actual use

- Lazy-load authenticated pages and the assistant; the current single bundle
  ships dashboard/assistant code to landing-page visitors.
- Add a not-found route and meaningful retry states. Several loaders only log
  failures to the console; avoid presenting a request failure as an empty list.
- Make finding accordions keyboard accessible, give icon-only controls names,
  and add visible focus and reduced-motion support. Verify modal focus trapping
  and narrow-screen layouts in browser tests.
- Persist selected organization safely for the current user and carry explicit
  organization context in finding deep links.
- Add team/settings screens to the existing member API after A01 is fixed.

## Additions with the most product value

| Order | Addition | Concrete user benefit | Prerequisite |
| --- | --- | --- | --- |
| 1 | Finding lifecycle and scan comparison | Show new, persistent and fixed issues; acknowledge or dismiss with a reason; link exact source line at scanned SHA. | Correct scanner coverage, stable identities, commit metadata. |
| 2 | Finding-specific remediation drafts | Open a real finding directly in a prefilled review flow, show patch diff, copy/download it, and retain sources/limitations. | Bounded context, authorization, diff applicability checks. |
| 3 | Reviewable draft PR | Propose a branch and draft PR containing the chosen patch and validation report. | Explicitly scoped write permissions, user-reviewed diff, SHA/conflict checks and a restricted validation runner. Current scanning worker is not a safe arbitrary test runner. |
| 4 | JSON/SARIF export | Share exact scan, rules, finding evidence and risk factors with reviewers/tools. | Immutable scan provenance and pagination. |
| 5 | Push/PR-triggered scans and optional schedules | Scan new code automatically and show status on the relevant commit. | Verified webhook signatures, deduplication, quotas and cancellation first. |
| 6 | Dependency and secret detection | Cover lockfiles and credential patterns alongside SAST. | New adapters, separate confidence/type labels, safe evidence handling; do not claim complete coverage. |

Recommended delivery order: fix A01–A03 and the inaccurate claims; then repair
finding navigation, pagination, scan provenance and job recovery; then ship
finding-specific drafts, comparison and export. Add PR automation only after
the underlying scan and patch-verification contracts are reliable.

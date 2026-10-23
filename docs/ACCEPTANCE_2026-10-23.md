# Scheduler recovery and MongoDB lifecycle acceptance

## Changes

Automation workers now claim jobs with unique lease tokens. Completion updates match
that token, so an expired worker cannot clear a replacement worker's lease or
overwrite settings changed while it was queueing a scan. Settings changes and
organization deletion invalidate outstanding claims. Successful event processing
removes only its pinned commit, preserving concurrently received commits and the
independent scheduled-scan deadline. Each maintenance pass attempts at most five
distinct configurations per queue. Webhook storage rechecks the current installation
and event setting before adding a commit.

These guards protect automation state; they do not cancel a scan already accepted
by the scan service. Scan authorization, quota enforcement, active-scan deduplication,
and cancellation remain the responsibility of the existing scan service.

## Live database checks

From `backend/`, run `npm run test:lifecycle:live`. The command requires the configured
`DATABASE_URL` and database-user permission to create and drop an isolated test
database. It generates a fresh `avpr_acceptance_` namespace, checks that it is empty,
disables automatic collection/index creation before that check, and creates only
synthetic fixtures. It never uses the configured application's database as its write
target. Cleanup checks the exact generated namespace again before dropping it.
If a run is interrupted, its printed disposable database name identifies any fixture
database requiring cleanup; no cleanup is attempted against other namespaces.

On 23 October 2026, the configured Atlas cluster passed all six checks:

- Refusing owner account deletion rolls back the account lock and membership changes.
- Personal deletion removes only the deleted account's sessions and unlinks its identity.
- A concurrent membership grant cannot leave a deleted account with active membership.
- An incorrect organization confirmation rolls back owner suspension.
- Organization deletion disables access, revokes invitations, invalidates automation
  claims, and cancels active scans without changing the control organization.
- Purging waits for eligibility, requires multiple passes above the 500-record batch
  boundary, and preserves the control organization's membership.

Seven additional real-database automation checks passed in a subsequent disposable
run, bringing the combined check count to thirteen:

- A competing dispatcher cannot claim a live lease.
- Expired-lease recovery prevents the original worker from overwriting its replacement.
- Invalidating a claim during a settings change preserves the new disabled state.
- Event completion preserves a commit received during processing and the schedule deadline.
- Failed enqueue releases the claim, defers retry, and retains no raw upstream error.
- Concurrent duplicate webhook deliveries store one commit.
- A full event queue preserves delivery retry, which succeeds after capacity is freed.

Only the scan-enqueue boundary is substituted in these automation checks; MongoDB
claiming, finalization, webhook deduplication, and pending-reference updates are real.
No GitHub requests or scan jobs are submitted. Lease expiration is advanced directly
on the fixture record; this is not a process termination/restart drill. The queue-full
test verifies persistence/retry, not provider HTTP redelivery. The original six lifecycle
checks also passed in this combined run, and cleanup completed successfully.

The disposable database was successfully dropped. An initial attempt failed before
fixture creation because Atlas limits these database names to 38 bytes; generated
names are now 35 bytes. Error output contains phase/category/code, not connection
strings or raw provider messages.

## Scan completion and cancellation race

The worker previously inserted findings before checking its completion lease. A
cancelled or replaced worker could therefore leave findings behind even though its
completion update was rejected. Evidence persistence and completion now share one
MongoDB transaction. The transaction first conditionally locks/updates the scan using
its running state, cancellation flag, and claim token, then upserts findings within
that same session. An unmatched claim writes no findings. A failed finding write
rolls back the scan update and every finding in the batch. Success notifications
are sent only after commit; workspace cleanup still runs after failure.

Four additional real Atlas checks passed, bringing the combined disposable run to
**17 checks**: successful atomic persistence, rejection after cancellation, rejection
after lease replacement, and full rollback on a forced duplicate-key finding write.
The failure test preserves a sentinel finding while verifying the new evidence batch
and completion marker are absent. All earlier lifecycle/automation checks passed
again, and the disposable database was dropped. Two worker regressions additionally
cover cancellation with nonempty scanner output and notification/cleanup behavior
on a finding write failure. These checks do not terminate a real worker process or
exercise provider redelivery, so those operational drills remain open.

The settling-period check advances the service's injected clock; it does not wait
24 hours. These tests exercise real MongoDB transactions and one concurrent grant,
not load testing, worker termination/restart, backups, restore procedures, OAuth, or
independent non-owner acceptance. Those roadmap criteria remain open.

## Overdue scan recovery in both worker runtimes

Previously, the Vercel polling loop expired overdue records, but local BullMQ
maintenance did not. Shared maintenance now connects to the database when needed
and runs a bounded expiry service in both runtimes. Each expiry call selects at
most 500 active overdue records and rechecks status/deadline during the write.
Completed, cancelled, future-deadline and legacy null-deadline records are excluded.
Enqueue-time cleanup uses the same normalized repository lock as scan creation, so
different owner/repository casing cannot strand an expired lock. A compound
status/deadline/ID index supports the maintenance query.

Completion additionally requires an unexpired deadline (or a legacy null deadline)
inside its transaction, preventing success while the maintenance sweep is pending.
Three additional real Atlas checks bring the combined run to **20 checks**: expiry
rejection before maintenance, scoped normalized-lock cleanup preserving other
records/organizations, and recovery of 501 overdue jobs in two bounded passes with
an empty third pass. The disposable database was dropped successfully. This proves
database recovery semantics, not an actual worker process restart or queue failover.

## Release status

The combined follow-up passes 465 backend tests across 64 suites, 19 frontend unit
tests, all 89 mocked browser journeys, and both builds. The acceptance tool has deterministic guards against missing
opt-in and cleanup against a different database.

The preceding release, `c1137ff`, was pushed and verified on production with successful
CI, database-backed health, and protected-route checks. This follow-up remains local
under the user's instruction to commit without pushing. It changes backend behavior
and acceptance tooling; no frontend redesign or external account settings are included.

## Real HTTP team and cancellation checks

Ten additional checks exercise the actual Express routes, authentication/role/access
middleware, audit records, and MongoDB transactions. A private test-only HTTP app
substitutes allowlisted fixture identities for OAuth sessions and reloads each account
from MongoDB on every request. It is not mounted in the product. Invitation email is
explicitly disabled; test links remain inside the harness and are never printed.

Four cancellation checks cover signed-out/cross-organization denial, authorized
cancellation and its audit/lease effects, replay/terminal conflicts, and queued scans.
Six team checks cover exact-email acceptance, single-use tokens, revoked/expired
links, role restrictions, ownership transfer, owner protection, self-leave, and a real
concurrent acceptance/revocation race with one consistent committed outcome.

The audit found and fixed unconditional saves after reads: revocation now matches a
pending invitation atomically; member removal/role changes match the previously read
active role, returning a conflict after a concurrent role or status change. A stale
request cannot overwrite an accepted invitation or demote/remove a newly promoted
owner through these writes. Unit regressions cover those guarded conflicts.

## Actual worker-process recovery drill

Two additional checks launch real Node child processes running `processScanJob` with
the production claim, normalization, persistence, completion, and notification paths.
The workspace/download and scanner-output boundaries use trusted synthetic fixtures;
no source download, scanner executable, or repository code is run. Redis and Vercel
queue clients are disabled in the child environment, and every connection targets
the parent's verified disposable database.

The first drill terminates a process after it claims a scan, advances only that
fixture's lease, and recovers it through a new worker process. A duplicate delivery
after completion is skipped and exactly one finding remains. The second cancels a
running child through the real HTTP route and then releases its synthetic scanner:
the worker cannot persist findings or send success notifications, and its cleanup
callback runs. All child processes are stopped before database cleanup.

The combined run now passes **32 checks**, including the previous twenty. Cleanup
completed successfully. These drills do not prove real queue/provider redelivery,
waiting for wall-clock lease expiry, production daemon failover, filesystem orphan
reaping, external OAuth, or independently operated non-owner acceptance. Those
criteria remain open.

## Signed invitation delivery callbacks

Three additional signed HTTP/MongoDB checks bring the combined acceptance run to
**35 checks**. They verify signature rejection, idempotent and conservative delivery
state transitions, isolation from replaced invitation attempts, and protection of
accepted invitations. The handler uses the pinned Standard Webhooks verifier with
raw bodies and timestamp validation. The settings list distinguishes provider
acceptance from recipient-server acceptance and provides delay/failure guidance.
No real email was sent, and no provider webhook was provisioned. See
[invitation email setup and limits](INVITATION_EMAIL.md).

On 23 October, the authenticated GitHub settings UI also confirmed Contents
read-only, Pull requests no access, and an empty webhook URL. Settings access was
unlocked by the owner. Expanding permissions requires the owner to make the access
change directly; no permission update or live draft PR has been verified.

## GitHub event eligibility and workspace response isolation

Event eligibility now checks the public HTTPS receiver, JSON content type,
certificate verification, remote secret configuration, and individual app event
subscriptions using read-only GitHub requests. Missing/failed checks disable the
corresponding trigger; settings writes recheck the requested event. Existing
triggers can still be disabled without working webhook configuration, and schedules
remain independent. Ten readiness and two settings regressions passed. Live reads
returned 200 for App metadata and 404 for webhook configuration; eligibility
correctly failed closed. See [configuration checks and limitations](GITHUB_EVENTS.md).

Automation controls now show initial loading, clear the previous workspace form on
scope changes, ignore old fetch responses, and ignore old save results/errors after
switching workspaces. Three frontend unit regressions cover the load/save races.
The expanded browser suite additionally covers independent event eligibility and
disabling an existing trigger after configuration becomes unavailable.

## Pinned public-advisory scanner pilot

The offline pilot fetched six hash-verified source files from the parent/fix
revisions of two published upstream security fixes. Actual Semgrep 1.181.0 and
Bandit 1.9.4 runs covered the expected files. Semgrep alerted on all eight selected
unsafe call sites before the fixes; Bandit additionally alerted on the four Python
sites. No corresponding patched sites alerted. Four other shell alerts remain
unadjudicated. This does not establish precision, recall, whole-project security,
or correlation quality. Labels are project-authored and independent benchmark
acceptance remains open. No upstream code/tests were executed and no source files
are committed. Host/WSL cleanup completed. See the
[method, limits and retained evidence](SCANNER_BENCHMARK.md#public-advisory-pilot--23-october-2026).

Nineteen added regression checks cover manifest pinning/path restrictions,
download integrity and size limits, metadata-only reporting, target matching,
required scanner availability, exact coverage and cleanup after success/failure.
The backend suite now passes **484 tests across 65 suites**. Frontend content was
unchanged by this CLI-only follow-up; its previously verified 19 unit tests and
89 browser journeys remain the latest frontend evidence. No push or external
configuration change was performed.

## GitHub identity versus repository installation

The repository connection panel previously offered another GitHub sign-in whenever
the workspace had no installation, including immediately after successful GitHub
OAuth. The installations response now includes current-session authorization
metadata separately from the installation list. A fresh verified session with no
installations is distinguished from missing/expired authorization. A linked
username alone is never treated as current authorization.

Verified users now proceed to installation selection or App installation without
a duplicate sign-in action. Linked accounts needing renewed authorization see
"Verify GitHub access" with an explanation. A refused connection caused by expired
authorization restores that recovery action. Repository authorization rules remain
enforced by the backend; the interface does not infer authority from a username.
This change remains local until a future authorized release.

Validation: 489 backend tests, 23 frontend unit tests, three targeted repository
connection/revocation browser journeys, and both production builds passed. The
deployed GitHub OAuth flow also reached the signed-in dashboard in Edge before
this local interface change; deployment of this update has not been performed.

## Release and proposed-fix verification follow-up

Release ad00a11 subsequently combined the four unpublished commits and was pushed
on explicit instruction. Vercel served that exact revision with MongoDB connected;
health and the GitHub OAuth redirect checks passed. Both GitHub CI jobs completed
successfully. The following patch-rescan work is later local work, not that release.

The paired rescan path runs baseline and patched static checks against the exact
authorized snapshot, verifies source/patch/policy hashes and stable coverage, and
rejects suppression additions, remaining target alerts, new rule/path alert counts,
cancelled/replaced workers and mismatched results. Draft PRs require matching,
unexpired static proof. Project tests are still explicitly unavailable.

Actual NVIDIA-generated SQL/JavaScript and YAML/Python proposals passed both
synthetic paired scans with real Semgrep 1.181.0, Bandit 1.9.4 and credential checks.
No repository code or suggested tests were executed. Four added real MongoDB
checks bring disposable lifecycle acceptance to **39 checks**, with successful
cleanup. The full browser run passes **89 journeys**; the later automatic-rescan
and feedback follow-up passes three targeted journeys, including the new fresh-
consent case. Frontend unit checks pass **29 tests** and backend checks pass
**528 tests across 68 suites**. Both production builds pass. The retained evidence
also includes a repeated NVIDIA SQL proposal that the scanner correctly rejected;
the subsequent guided proposals passed. See
[verification flow and evidence](PATCH_VERIFICATION.md).

A dependency-free Node test profile for fresh GitHub-hosted VMs and its CI isolation
contract are prepared but not yet hosted-validated or connected to customer jobs.
Local Docker's engine is unavailable; unit checks of the command policy do not
substitute for that hosted contract. Customer test execution remains disabled.

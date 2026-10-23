# Proposed-fix verification

Status: paired static rescanning is implemented locally. Repository test execution
is **not enabled**. Neither a model response nor a passing static rescan establishes
functional correctness or proves that a repository is secure.

## User flow

1. Open a finding's AI review, explicitly approve sharing the shown source with
   NVIDIA, and request a proposal.
2. Check that the single-file diff applies to the immutable scanned source.
3. A finding-specific proposal starts its security rescan automatically; the panel
   provides retry and cancellation. The API validates the source/diff/syntax and queues
   a bounded job. The existing scan daemon processes queued rescans during its
   maintenance pass. Development without the daemon uses an asynchronous local
   invocation, like existing development scans.
4. The worker downloads the authorized pinned snapshot, checks source and proposed
   hashes, and runs Semgrep, Bandit and credential checks before and after changing
   only the temporary snapshot. It discards any WSL snapshot before the second scan.
   It does not execute repository code, dependency installation or project tests.
5. Review the result. The original rule must reproduce at the original location;
   afterward it must be absent across the entire target file. Increased alert
   counts for any scanner/rule/path block a passing result. Moving an alert alone
   does not pass. The UI says **Static checks passed — tests not run**.
6. A reviewed draft PR additionally requires a matching, unexpired passing job,
   owner/admin role, acknowledged unexecuted tests, GitHub write permissions and an
   unchanged default-branch commit. There is no automatic merge/default-branch write.

Static comparison uses counts by rule and path; it may not distinguish replacement
of an old alert with a different alert of the same rule/path. No semantic or
whole-program safety guarantee is claimed. Dependency findings and languages
outside JavaScript/JSX, TypeScript/TSX and Python currently cannot use this rescan.
The initial proposal limit remains one source file of at most 8,000 characters.

## Job controls and retained data

- Organization/scan/finding membership scopes all reads, starts and cancellation.
  The worker rechecks the organization and requester's membership. It uses a unique
  lease, renewed during execution, and only that lease can publish a result.
- Requests are capped at 60/hour per organization and new rescan jobs at 20/hour.
  Two shared worker slots cap concurrency. Identical proposals/policies reuse a job.
- Queue deadlines are ten minutes. Execution is capped at three minutes; explicit
  cancellation and membership loss abort scanner work. Expired jobs fail closed.
- Missing scanners, analysis errors, changed file coverage/tool versions, source or
  patch mismatches, added `nosemgrep`/`nosec` markers, or cleanup failure cannot pass.
- Patches are transient private job input, excluded from API payloads. They are
  removed on completion/failure/cancellation/expiry processing. Jobs have a 24-hour
  TTL as a backstop; MongoDB TTL cleanup is asynchronous. Organization erasure also
  purges jobs. Result payloads retain metadata/hashes, not source or scanner output.
- The reviewed draft-PR verification record retains the rescan job ID and policy/
  rule hashes alongside the source/patch hashes after the transient job expires.

## Evidence

`npm run test:remediation:live` in `backend` sends only the two checked-in synthetic
source samples to the configured NVIDIA service. It uses real model proposals,
exact patch application, actual static scanners and cleanup, substituting only the
GitHub snapshot download with those synthetic local files. It never executes the
samples or generated tests. Do not present it as independent real-project accuracy.

The 23 October run generated JavaScript SQL and Python YAML proposals. Both original
alerts reproduced, both were absent after the proposal, and no alert-count
regressions were detected. See [retained metadata](evidence/remediation-nvidia-2026-10-23.json).
An independent repeat invocation rejected a SQL proposal because its alert remained
while the YAML proposal passed; that [negative result is retained too](evidence/remediation-nvidia-repeat-2026-10-23.json).
After adding deterministic rule guidance, a [guided invocation](evidence/remediation-nvidia-guided-2026-10-23.json)
passed both examples. These few varying outputs do not establish a model success
rate or a causal prompt-improvement measurement. A rejected patch offers bounded
scanner feedback in the UI; the user reviews the revised request and gives fresh
NVIDIA consent before another proposal. Other repository paths are not included
in that feedback. Host-prefixed Semgrep IDs resolve to the existing fixed guidance
without changing stored finding identities or review history.
The disposable MongoDB acceptance suite also exercises cancellation, duplicate
delivery, stale leases, exact proof binding and cross-organization isolation.

## Project-test runner: gated next stage

No separately owned Linux server is configured. A GitHub-hosted runner profile and
CI isolation contract are prepared under `backend/runner/`; customer test execution
is not wired into rescan results. It supports dependency-free Node tests only and
must first pass its hosted isolation contract. It is not a general npm/pip runner.

The supervisor requires a standard GitHub-hosted Linux x64 VM; runs a digest-pinned
Node image with no network, a read-only root/source, nonroot UID, dropped
capabilities, no-new-privileges, bounded memory/CPU/PIDs/files/output/time and no
inherited application credentials; and confirms container removal. It never
executes arbitrary command strings or runs dependency installation. Missing tests,
an unavailable image/engine or failed cleanup are not passes.

Before enabling customer tests: pass hosted boundary/timeout/output/cleanup checks,
review the supervisor independently, implement an authenticated exact-job/commit/
patch result channel and cancellation, and prepare a reviewed dependency policy
for projects needing packages. Keep the existing `allowed_tests: unavailable`
record until those conditions hold. The profile's environment check is an operator
guard, not cryptographic proof that a host is GitHub-operated.

References: [GitHub-hosted VM boundaries](https://docs.github.com/en/actions/reference/runners/github-hosted-runners),
[GitHub token permissions](https://docs.github.com/en/actions/reference/security/secure-use),
[Docker runtime controls](https://docs.docker.com/reference/cli/docker/container/run),
[network isolation](https://docs.docker.com/engine/network/drivers/none/).

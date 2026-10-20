# SecurePatch: move from prototype to private beta

SecurePatch already has a real product path: GitHub and Google sign-in, team
workspaces, an installed GitHub App, private-repository scans, a persistent
worker, findings with commit provenance, review status, JSON/SARIF exports and
NVIDIA-backed assistance. The deployed app was verified against a real private
repository. This roadmap focuses on the gaps that matter before inviting teams
to rely on it.

## Private beta entry criteria

### 1. Make the GitHub connection useful and explicit

The installed `avpr-net` App currently has repository Contents read, Email
addresses read and Metadata read. It has no subscribed events and no active
webhook. Consequently the API correctly blocks draft pull requests, and
push/pull-request rescans are not live.

- Keep installation selection limited to repositories the customer chooses.
- If draft PRs are part of the beta, request only repository Contents write and
  Pull requests write. The app creates a proposal branch and draft PR; it never
  merges or writes to the default branch.
- If event scans are part of the beta, set a server-only webhook secret and
  subscribe only to `push` and `pull_request`. Start with default-branch pushes
  and opened, reopened or synchronized pull requests.
- Show the exact requested permissions and their purpose on the connect screen.
  Handle installation permission updates and declined requests clearly.
- Exercise installation selection, revocation, branch protection and retries
  against a disposable repository before enabling this for external teams.

### 2. Measure scanner quality before making coverage claims

The current bundled Semgrep configuration has twelve project-owned rules, plus
Bandit and local credential-pattern checks. Optional dependency advisory checks
cover npm lockfiles. This is a useful narrow baseline, not broad enterprise SAST
or full SCA coverage.

- Pick the first supported languages and frameworks from the teams you can
  actually pilot with; start with JavaScript/TypeScript and Python if those are
  representative.
- Document every rule's intent, supported files, severity mapping, limitations
  and known false positives.
- Build a versioned benchmark from safe vulnerable and fixed fixtures. Measure
  detection and false-positive rates by rule before changing defaults.
- Expand rules only from sources whose license permits the intended hosted use,
  or write and review original rules. Pin the version and record it with scans.
- Add language-specific dependency lockfiles deliberately. Keep package names
  and versions sent to the advisory service opt-in and visible to the user.
- Keep partial coverage and scanner failures prominent; never turn a failed or
  unsupported scan into a clean result.

### 3. Finish team onboarding and account lifecycle

Current team settings can add an email only after that person already has a
SecurePatch account. There is no invite delivery and acceptance workflow yet.

- Add invitations with a short-lived, single-use token; store only a hash of the
  token and bind acceptance to the invited verified account email.
- Send invitations through a selected mail provider, with expiry, resend,
  revoke and audit history. Do not add passwords when OAuth is already used.
- Test joining, leaving, removal, owner transfer, account linking and re-entry
  across multiple organizations.
- Add account and organization deletion/export flows with a documented data
  retention period for scans, source excerpts, findings, AI request metadata
  and backups.

### 4. Explain customer data handling before they connect a repository

The service processes private repository source transiently for scanning and
stores findings. AI requests may send sanitized excerpts to NVIDIA. Redaction
reduces exposure but cannot guarantee arbitrary source text has no secrets.

- Publish reviewed Privacy, Terms and security-contact pages before accepting
  customer code outside a private pilot.
- State what is fetched, what is retained, retention periods, subprocessors,
  deletion behavior and what is transmitted when AI or dependency checks run.
- Provide an organization setting to disable hosted AI, and make the data sent
  visible before the first request.
- Create an incident-response runbook and a documented process for reporting a
  vulnerable finding without including private repository contents in logs.
- Keep OAuth tokens ephemeral, restrict App permissions, and test uninstall and
  session revocation paths.

### 5. Operate the worker as a service

Production currently reports the API, MongoDB and scan worker ready. Readiness
checks prove current availability, but a product needs detection and recovery
when availability changes.

- Alert on stale worker pulses, oldest queued scan age, repeated scanner errors,
  database failures, AI provider timeouts and webhook signature/replay rejects.
- Add correlation IDs across enqueue, worker, scanner and result persistence;
  log counts, durations and scanner versions without logging source code, keys
  or raw provider bodies.
- Test worker restart, duplicate webhook delivery, stuck job expiry, database
  failover and backup restoration.
- Set explicit limits and a support path for scan size, language coverage,
  runtime, concurrency and provider quotas.
- Run a focused external security review before treating this as a general
  public service.

## Suggested rollout

1. **Internal alpha:** use AVPR and two or three repositories the team owns.
   Track successful scans, scanner failures, review time and false positives.
2. **Private beta:** invite a small number of teams with supported languages and
   private repositories. Keep scans advisory; do not block merges on these rules.
3. **Public launch:** follow only after scanner benchmarks, data policies,
   incident handling, account lifecycle and permission/revocation behavior have
   been exercised by teams other than the authors.

## Exit checks for a dependable private beta

- Each supported language has a published rule inventory and a repeatable
  benchmark with measured precision and recall.
- A team can join through an expiring invitation, scan a selected repository,
  review a finding and revoke the App without developer intervention.
- A fresh scan pins a commit, records scanner coverage and can be exported; a
  failed or partial run cannot be mistaken for a clean result.
- AI-generated changes become a deterministic, source-matched diff; syntax
  checks, unexecuted tests and all assumptions are plainly shown.
- Data handling, retention, deletion, support and incident procedures are
  published and tested.
- Worker, database, OAuth, webhook and scanner failures raise actionable alerts.

The implementation and release evidence for the October 2026 hardening pass is
in [the audit delivery record](IMPLEMENTATION_2026-10-20.md). The currently
observed GitHub App permissions and event state must be rechecked after each
GitHub settings change.

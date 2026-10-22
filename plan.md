# AVPR-Net Product and Architecture Plan

This plan reconciles the 19-document AVPR-Net specification archive with the implementation in this repository. The archive describes the intended full platform; it is not evidence that every described capability is already implemented. Work is ordered so the product's real account, scan, review, and trust workflows are dependable while continuing to use NVIDIA-hosted inference.

## Current baseline

The project already has:

- Google and GitHub OAuth sign-in, organizations, role-based access, invitations, and GitHub App installation access.
- GitHub repository listing and source browsing, immutable-commit scans, scan history, coverage/error reporting, and bounded temporary workspaces.
- Semgrep with twelve project-owned rules, Bandit, local credential-pattern checks, and optional npm lockfile advisory checks through OSV.
- Finding provenance, deterministic deduplication, heuristic risk factors, review decisions with reasons/history, scan comparison, and JSON/SARIF export.
- NVIDIA-hosted Nemotron assistance, retrieval over an approved shared knowledge corpus, proposal/diff validation, and optional owner/admin draft pull requests.
- Opt-in weekly/monthly repository automation and signed GitHub event handling, subject to external GitHub App and deployment configuration.

The main implementation references are [README.md](README.md), [the implementation record](docs/IMPLEMENTATION_2026-10-20.md), [the product roadmap](docs/PRODUCT_ROADMAP.md), [the scanner baseline](docs/SCANNER_BASELINE_V1.md), and [the deployment configuration](vercel.json).

## Frontend maintenance

A local consistency and usability pass covers public, authentication, repository, scanning, findings, settings, and assistant screens. It unifies theme tokens, removes redundant content, improves navigation and recovery controls, and is verified by 16 frontend unit tests, 86 browser journeys, and a desktop/mobile theme matrix. See [the frontend audit](docs/FRONTEND_AUDIT_2026-10-22.md). These checks use mocked APIs and do not replace the live-account acceptance work below.

## Consolidated remaining work — reconciled 22 October 2026

This is the current work count across this plan, PRODUCT_ROADMAP.md, the implementation record, the runner design, and the frontend audit: **17 open work packages**. These packages are not 17 missing features or 17 small fixes: many are live acceptance tests, operations, or release steps. Local inference is excluded. The optional M4 scoring replacement is excluded unless separately chosen.

The detailed phases below retain 15 unchecked entries, including one conditional M4 entry; two Phase 1 entries describe overlapping account acceptance work. Do not add those entries to this list or count duplicated roadmap bullets again. Completed implementation is not proof of live acceptance or deployment.

| ID | Open work package | Evidence / scope | Implementation check — avoid duplicate work |
| --- | --- | --- | --- |
| R01 | Fresh non-owner account acceptance | Real Google/GitHub sign-in, organization creation/joining, installation, scan, review, sign-out, and account/team lifecycle. Consolidates the two overlapping Phase 1 entries. | Core flow implemented; fresh non-owner live acceptance pending. Preserve existing auth/team/scan code. |
| R02 | GitHub installation edge cases | Live repository selection/access changes, revocation, quota behavior, branch protection, and large repositories. | Access handling and bounded downloads implemented with deterministic tests; live edge-case evidence pending. |
| R03 | Independent scanner benchmark | Reviewed real project samples and measured rule-level detection/false-positive rates. | Synthetic scanner contract and offline annotated-data evaluation CLI exist; independent real-project benchmark is missing. See docs/SCANNER_BENCHMARK.md. |
| R04 | Finding identity evaluation | Measure false merges and duplicates against reviewed repositories. | Fingerprinting/deduplication and offline duplicate/false-merge/false-split measurement tooling exist; reviewed real-project measurements are missing. |
| R05 | Risk heuristic review | Review existing factors with security reviewers; no M4 replacement is assumed. | Risk factors and disclosure exist; independent security review is missing. |
| R06 | Implement and deploy the isolated runner | The runner design is complete; the isolated execution service, host, resource controls, and adversarial validation are not. | Design only; isolated runner service and deployment are missing. |
| R07 | Proposal verification orchestration | Tie allowed tests/rescans to the proposal and originating finding; depends on R06 and proposal-branch scanning. | Integrity/syntax records exist; allowed tests and proposal security rescans explicitly return unavailable. Extend, do not replace. |
| R08 | Invitation email delivery | Select/configure a provider and implement delivery status, expiry/resend handling, and acceptance tests. Manual invitation links remain the default. | Optional Resend transport, explicit UI opt-in, provider-acceptance status, safe fallback, cooldown, and atomic pending-state refresh are implemented locally. Verified sender setup, real receipt, delivery/bounce callbacks, and production acceptance remain pending. |
| R09 | Retention and deletion acceptance | Finalize backup/log retention and deletion-aware restore policy; test real MongoDB concurrency, erasure, restarts, and large datasets. Deletion implementation already exists locally. | Account/org deletion and bounded purge implemented locally with deterministic tests; live acceptance, retention policy, and release pending. |
| R10 | Scheduled scan reliability | Realistic schedule, duplicate delivery, cancellation, quota, lease expiry, restart, and stale-queue recovery tests. | Schedule dispatcher, leases, retry, and worker recovery code exist. Seven additional recovery/event tests cover pending commit retry, lease release, bounded claims, replay, queue-full retry, and unselected refs. Live operational acceptance is still pending. |
| R11 | Live GitHub event scans | Confirm webhook secret/subscriptions and exercise push/PR selection, signatures, replay handling, and recovery. | Signed webhook handler and event deduplication exist; GET /app reconfirmed no event subscriptions. Live setup and acceptance remain pending. |
| R12 | Live draft PR enablement | Recheck current GitHub App and installation write permissions; enable if needed and verify the reviewed draft-PR path on a disposable repository. Read-only GET /app on 22 October reconfirmed Contents read, Email read, Metadata read and no event subscriptions. | Reviewed draft-PR creation and cleanup implemented with mocked GitHub tests; app-level read-only permissions reconfirmed through GitHub API; installation permission acceptance and live creation remain pending. |
| R13 | Operational monitoring and alerts | Worker heartbeat, queue age, repeated failures, webhook rejects, sanitized alerts, and correlation IDs. | Health/readiness, heartbeat, request IDs, and sanitized logs exist. A read-only ops:check CLI now evaluates queue age, heartbeat, scan failures, partial coverage, and fixed-category error counters. Monitoring deployment and an external alert destination remain pending; see docs/OPERATIONS_RUNBOOK.md. |
| R14 | Infrastructure recovery drills | MongoDB restoration, queue/daemon availability, deployment rollback, session invalidation, and uninstall/revocation. | Recovery mechanisms have some deterministic coverage; live restore/rollback/failover drill evidence is missing. |
| R15 | Public data-handling and support information | Privacy, terms, retention/subprocessors, security/support contact, and incident-response procedures. | Technical data-control/retention docs exist; reviewed public policy/support/incident information is not complete. |
| R16 | Independent security and beta review | External security assessment and cross-account beta coverage beyond the owner-account smoke test. | Internal audits and tests exist; independent external assessment/beta sign-off is missing. |
| R17 | Release and production acceptance | Review and release the unpushed local backend/frontend changes, then verify the deployed revision and affected flows. Current UI checks use mocked APIs. | Local feature commits are 39d2587 (backend, shubhampardule) and fae2bd8 (frontend/branding, Patil-26). A final documentation/verification commit follows under shubhampardule. Push, production release, and deployed-revision acceptance remain pending. |

**Implementation cross-check:** none of the 17 packages has yet completed its full stated live/external acceptance criteria. Eight packages (R01, R02, R08–R13) have their main application implementation or local monitoring path and should proceed to remaining configuration/acceptance rather than rebuilding it. R08 still lacks inbox delivery/bounce callbacks; R13 still needs deployed counters and external alert routing. Two packages (R06–R07) require substantial runner/orchestration implementation. Seven (R03–R05, R14–R17) are evaluation, operations, policy, independent review, or release work; evaluation tooling for R03/R04 now exists. Preserve the completed parts within every package.

**Read-only live observations, 22 October:** the configured MongoDB and worker were reachable, with no queued backlog or recent failed/partial scans at the time checked. GitHub GET /app confirmed the App remains read-only and has no subscribed events. These observations do not prove non-owner OAuth, successful provider calls, external alerts, or recovery drills. No real invitations were emailed and no live deletion was performed.

Other records are references, not additional backlogs: the A01–A18 historical audit items have implementation follow-ups; the product roadmap groups overlapping work into five themes. Some statements in that older roadmap (for example, “add account deletion”) predate the local implementation. The current architecture, lifecycle documents, and implementation record take precedence for implemented behavior. Live external configuration still needs verification.

## Product rules

1. Keep NVIDIA hosted inference as the AI provider for the current roadmap. Store `NVIDIA_API_KEY` only in the backend environment or deployment secrets; never expose it through frontend code or a `VITE_` variable.
2. Local-LLM work is outside the current scope. Keep NVIDIA-hosted inference as the supported provider.
3. Keep scanner output authoritative. AI explanations and code changes are proposals that require human review.
4. Never call a scan clean when its required scanners failed or coverage is partial. Show the commit, branch, scanner coverage, errors, timestamps, and status.
5. Do not execute repository code or tests until an appropriately isolated runner, resource limits, and recovery controls exist. Clearly say when tests were not run.
6. Mark every feature as **implemented**, **in progress**, **planned**, or **deferred** in product copy and documentation.

## Ordered work

### Phase 0 — Make the specification match reality

- [x] Treat the attached v1.0 documents as target design, not current implementation. Added [the specification archive status and index](docs/SPECIFICATION_ARCHIVE.md) so they cannot be mistaken for a shipped-feature list.
- [x] Create one canonical architecture and feature-status reference from the current code and deployment. Added [the current architecture reference](docs/CURRENT_ARCHITECTURE.md) and linked it from the README and submission summary.
- [x] Reconcile conflicting statements: Google/GitHub OAuth versus email/password; GitHub-only intake versus ZIP/URL; current risk formula versus the proposed M4 formula; Vercel Queues versus BullMQ/Redis; advisory draft PRs versus automatic patch application and verification. The current architecture reference states the implemented behavior; the proposal archive and historical hackathon log are labeled accordingly, and the README scan flow is corrected.
- [x] Update diagrams, API/module lists, data model, scanner list, supported roles, and UI screen inventory to match code. The current architecture reference records these and identifies unsupported capabilities as planned.
- [x] Keep the pre-fix audit clearly marked as historical and point readers to its implementation follow-up. Confirmed in the deep audit; added a historical-status notice to the earlier NVIDIA hackathon audit log.

**Exit check:** a new contributor can identify what runs today, what is planned, and what is explicitly unsupported without inferring behavior from the v1.0 proposal documents.

### Phase 1 — Prove the real user journey and make the first scan clear

- [ ] Exercise fresh Google and GitHub accounts through sign-in, organization creation/joining, GitHub App installation, repository authorization, scan, findings, review, and sign-out/revocation. The production owner account completed a real sign-in, repository listing, and scan smoke pass; a fresh non-owner account remains unverified.
- [x] Make the connected GitHub identity and installation/repository access state explicit. If a repository is missing, give a direct path to GitHub App settings and a useful refresh/retry action on return. Browser checks cover install selection, missing access, refresh, repository listing, and failure recovery. GitHub confirms AVPR-Net is already public; the public details page has no install button, so users should use `https://github.com/apps/avpr-net/installations/new`, which opens the account chooser after GitHub sign-in.
- [x] For every scan, show repository, branch, pinned commit, start/completion time, final state, scanners run, coverage, skipped checks, and actionable failure details. A focused browser test verifies these details for a partial scan and confirms the finding links to the exact source commit.
- [x] For each finding, show affected file/line, scanner and rule, severity, heuristic risk factors, plain-language impact, and a practical next step. Clearly distinguish scanner findings from AI suggestions. Added the scanner rule ID to the finding card and a browser check for provenance, severity, human-review state, risk factors, and next-step guidance.
- [x] Audit loading, empty, failed, partial, and stale-data states for organizations, repositories, scans, findings, and AI. Added explicit scan loading feedback, kept last-known scan/findings/repository results visible after refresh failures, and verified retry/recovery paths across these screens. Assistant setup and finding-preview errors now have retry actions; assistant retries preserve previously loaded context.
- [x] Verify that review/dismissal requires a reason, records who decided and when, and remains visible in finding history. Backend route/model tests verify persisted reviewer/time/reason fields; browser coverage now checks required reasons, retry after save failure, and history surviving reload.
- [ ] Add browser journeys for the real UI/API contract. All 83 Playwright journeys pass against mocked provider/API responses, including scan comparison, remediation verification, responsive scan notifications, ownership transfer, organization export, and member self-leave; fresh-account OAuth and cross-account GitHub App installation still require a non-owner test account. Production owner sign-in, repository listing, MongoDB-backed API health, and a completed scan have been smoke-tested separately.

**Exit check:** a new user can connect an authorized repository, understand exactly what was scanned, review a result, recover from a missing repository or failed scan, and distinguish an advisory from a confirmed scanner result.

### Phase 2 — Decide and implement repository intake and scanner scope

- [x] Return safe, retryable responses for GitHub primary and secondary rate limits. Deterministic tests cover reset and `Retry-After` timing, archive downloads, and distinction from permission errors; the repository page preserves the connected account and offers a working retry.
- [ ] Exercise the GitHub App installation against a disposable non-owner account, including repository selection, access changes, revocation, real quota limits, and large repositories. Deterministic coverage verifies authorized installation selection, removed-installation recovery, cached-installation cleanup, transient-error preservation, and bounded archive extraction. Live quota exhaustion, cross-account revocation, and large-repository behavior remain unverified.
- [x] Decide whether ZIP upload and arbitrary repository URL import are required for the first beta. Deferred both: GitHub App installations remain the only intake source until ownership checks, URL validation, bounded extraction, secret handling, cleanup, and access controls are designed and tested.
- [x] Decide whether the first beta requires Trivy. Deferred it; current source scanning does not include container or artifact coverage, and adding it needs a separate target definition, versioned adapter, and coverage tests.
- [x] Decide whether the first beta requires OWASP ZAP. Deferred it; network-active DAST needs explicit target authorization, request limits, isolation, and a separate user workflow.
- [x] Set first-beta dependency coverage to optional npm lockfile v2/v3 advisories only. Keep other ecosystems deferred until they can be validated and retain the existing opt-in disclosure of package names and versions sent to OSV.
- [ ] Build an independently reviewed benchmark for supported languages/rules and report precision/recall only when measured. Synthetic fixtures prove regressions, not production detection rates.

**Exit check:** every source and scanner shown in the product is implemented, tested, bounded, and accurately described; unsupported or optional coverage is visible.

### Phase 3 — Strengthen finding identity, correlation, and risk

- [x] Preserve scanner-specific evidence and provenance while correlating only findings with defensible evidence that they describe the same issue. Fingerprints and cross-scan correlation now include scanner, rule, path, CWE, and location; cross-scanner matches remain separate until a reviewed benchmark supports merging them.
- [ ] Measure current false merges and duplicates against reviewed repositories before introducing fuzzy or weighted cross-scanner correlation.
- [x] Decide whether to add a canonical vulnerability record separate from scan-specific evidence. Defer the canonical record for beta: cross-scan issue identity is not independently measured, and scan-specific findings keep lifecycle and review history tied to the exact evidence. Reconsider only after the repository benchmark validates identity and lifecycle requirements.
- [ ] Review the current path/CWE-based risk heuristics with security reviewers. Keep the factors and their limits visible; do not imply the score is exploit probability or CVSS.
- [ ] If replacing the score with the proposed M4 model, define reproducible factor inputs (attack surface, reachability, authentication, exploit complexity, and business context), version the formula, backtest it, and preserve historical score provenance.
- [x] Keep fixed/new/persistent comparisons conservative when scanner success, rules, tool versions, or covered files differ. The API now withholds all change labels without a successful matching baseline, scanner/rule/normalizer policy hashes, tool versions, and exact covered-file hashes; the scan page explains why the comparison is unavailable.

**Exit check:** a reviewer can trace every issue to original scanner evidence and understand why it was grouped and prioritized.

### Phase 4 — Build a controlled remediation and verification pipeline

- [x] Add structured, versioned remediation guidance for known issue types before relying on AI for every fix. AVPR-Net stores versioned deterministic guidance for its Semgrep rules, common Bandit IDs, credential patterns, and npm advisories; the finding card labels it separately from AI proposals. Unknown rules remain unmapped.
- [x] Keep AI patch suggestions pinned to the finding's source commit and constrain them to a single, bounded file change unless a reviewed workflow explicitly supports more. Finding context is read at the scan's immutable commit; the requested target path is explicit and validated, and patch checks accept only one exact file with bounded input/output. Draft PR creation rechecks the base commit and permission gate.
- [x] Before applying patches or running tests, design a per-job isolated runner with an unprivileged identity, no ambient secrets, restricted/no network, CPU/memory/time/disk limits, cancellation, and guaranteed cleanup. The proposal is in [the isolated-runner design](docs/ISOLATED_RUNNER_DESIGN.md); code execution remains disabled until a suitable host and adversarial verification are in place.
- [x] Apply a reviewed patch only in a new proposal branch; never change the repository default branch automatically. Draft PR creation revalidates a one-file diff against the immutable scanned source and current default-branch SHA, checks that SHA again immediately before opening the draft PR, requires explicit review acknowledgement and both GitHub write permissions, and deletes only the proposal branch if PR creation fails or the base changes. Service tests cover the no-default-ref-write guarantee and refusal/cleanup paths. Running project tests remains disabled until the isolated runner is deployed.
- [x] Add append-only verification records for patch integrity, syntax, allowed tests, and security rescans. Each check is explicitly passed, failed, skipped, or unavailable; records store commit/path and content hashes rather than source text. Invalid diffs record a failed integrity check and skipped dependent syntax check. Tests and post-patch rescans remain unavailable while the isolated runner and proposal-branch scanning are disabled, and the UI never treats those states as passes.
- [x] Preserve prior finding evidence and reopen a resolved issue when a later scan detects it again. Each scan stores a separate finding record; a previously resolved review is not copied to the new evidence, so the new instance starts open while the old scan and review history remain intact.
- [ ] Automatically tie post-patch verification jobs to the proposal and reopen the originating issue after a failed allowed test/rescan or a successful complete rescan that still detects the issue. Preserve both evidence sets. This depends on the isolated runner and proposal-branch scanning, which are not enabled.
- [x] Keep draft PR creation explicitly reviewed, permission-gated, base-SHA checked, and separate from merge/auto-apply behavior. The UI requires owner/admin role and an acknowledgement that tests were not run; the API enforces repository permissions and a matching base SHA. Only draft pull requests are created; merge and automatic application are not exposed.

**Exit check:** no patch is described as fixed until the configured verification requirements pass, and every skipped or failed check is visible.

### Phase 5 — Complete reporting, audit, and team workflows

- [x] Decide whether the product needs dedicated report generation beyond current dashboard history and JSON/SARIF exports. Deferred a separate report builder for beta; the dashboard covers live organization status and existing JSON/SARIF exports provide portable scan records with provenance. Revisit only if beta users need scheduled, cross-scan reports.
- [x] Add an append-only audit trail for security-sensitive actions such as installation changes, scan starts/cancellations, access changes, reviews, AI consent, patch proposals, and PR creation. `AuditEvent` records organization creation, scans, reviews, GitHub installation changes, membership/invitation changes, hosted-AI settings and consent, and draft PRs. It retains a pseudonymous actor ID, action, target, request ID, and action-specific metadata only; source code, invite links, emails, and review reasons are omitted. Owner/admins can read paginated recent activity. Application model hooks reject updates and deletes; failed writes are logged and marked on the action response.
- [x] Add scan-result notifications after defining event types, recipients, deduplication, retention, and failure handling. Active members receive completed, partial, or failed scan notices unless they disable their own preference; duplicate delivery is idempotent and notices expire after 90 days. Delivery is best effort and in-app only, so scan history remains authoritative. See [the notification policy](docs/NOTIFICATIONS.md). Email and a durable delivery outbox remain deferred until a provider and delivery-status flow are selected.
- [x] Add guarded organization ownership transfer. An owner can transfer to an active admin/developer after confirming the exact organization name; the two role changes are transactional, the former owner remains an admin, and the handoff is audited. The settings page refreshes the current role after success.
- [x] Add an owner/admin organization JSON export with memberships, invitations, repository automation settings, scan/finding summaries and review history, audit events, and remediation verification records. It omits source snippets, raw scanner stderr, OAuth/session credentials, GitHub installation IDs, and invitation token hashes; synchronous exports are capped at 25,000 records.
- [x] Let active non-owners leave an organization after confirming its exact name. The API suspends only the caller's membership in a transaction, verifies an active owner remains, and writes an audit event; owners must transfer ownership first.
- [x] Add guarded personal profile deletion. Exact email confirmation, active-owner refusal, transactional membership suspension, provider unlinking, profile pseudonymization, persisted session cleanup, and per-organization audit records are implemented. Organization creation and invitation acceptance serialize against account deletion. The settings flow remains available without an organization. See [account lifecycle and retained-data limits](docs/ACCOUNT_LIFECYCLE.md). Service and browser tests use mocked storage/provider responses; live deletion and concurrent MongoDB behavior remain unverified.
- [x] Add guarded organization deletion and primary-data erasure. Only a current owner can confirm the exact name; one transaction removes access, disconnects the installation reference, disables automation, revokes invites, cancels scans, and records the request. After a 24-hour settling period, worker maintenance erases scoped records in bounded retryable batches and preserves a minimal disabled tombstone. UI copy distinguishes queued erasure from completion. See [organization deletion and retention boundaries](docs/ORGANIZATION_DELETION.md). Live replica-set, concurrent-write, worker-restart, and large-data erasure checks remain unverified.
- [ ] Complete production retention and backup/log policies, deletion-aware restore procedures, and email invitation delivery for a private beta. Cross-account ownership transfer, new-account re-entry, personal deletion, and concurrent membership/deletion behavior still need live replica-set and non-owner tests.
- [x] Ensure current unresolved findings are distinct from historical scan totals and that partial/failed scans cannot silently resolve findings. The dashboard and organization Findings page keep historical totals separate and build current lists from each repository's latest completed scan with at least one scanner and no scanner errors; newer partial/failed/running scans show a warning and retain the prior complete baseline. The dashboard also reports accessible repositories without a full baseline, and both findings views exclude those repositories from current results.

**Exit check:** users can reconstruct who did what and when, receive useful actionable updates, and understand how their code and records are retained or deleted.

### Phase 6 — Harden automation and production operations

- [ ] Validate weekly/monthly schedules, due-job recovery, duplicate delivery, cancellation, quotas, lease expiry, worker restart, and stale-queue recovery under realistic conditions.
- [ ] Complete signed GitHub webhook setup and test push/PR event selection, replay/deduplication, default-branch behavior, permissions, and failure recovery before enabling events for customers.
- [ ] Monitor worker heartbeat, oldest queued scan, repeated scanner/provider/database failures, and webhook rejects; alert with sanitized logs and request/scan IDs.
- [ ] Test MongoDB backup restoration, Vercel queue/daemon availability, deployment rollback, session invalidation, and GitHub App uninstall/revocation.
- [ ] Publish privacy, terms, retention, subprocessors, security contact, support, and incident-response information before broad external onboarding.
- [ ] Run independent security review and cross-account beta tests; distinguish real provider tests from deterministic mocks.

**Exit check:** a failure is detected, explained, recoverable, and cannot be mistaken for a successful clean scan.

## Overall completion definition

The project is ready to move beyond a demo when Phases 0–6 pass their exit checks on a production-like environment with at least one account that is not an administrator of the app, and the product clearly reports its supported repositories, scanners, coverage, verification limits, and data handling. Local-LLM work is outside the current scope.

## Latest local verification

The release candidate passes 428 backend tests across 60 suites, 16 frontend unit tests, 86 browser journeys with AVPR-Net branding, frontend production build, backend Vercel bundle, and credential-pattern checks. Twelve rendered home/sign-in/settings views cover desktop/mobile and both themes, including the optional email control. The post-rename focused backend run passes 32 tests. Browser/service provider calls are mocked; separate database/worker and GitHub App observations were read-only live checks. No real invitation email, deletion, or GitHub permission change was performed. Existing history is preserved; current changes are grouped into three commits with the final commit under shubhampardule.

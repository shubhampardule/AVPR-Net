# SecurePatch Product and Architecture Plan

This plan reconciles the 19-document SecurePatch specification archive with the implementation in this repository. The archive describes the intended full platform; it is not evidence that every described capability is already implemented. Work is ordered so the product's real account, scan, review, and trust workflows are dependable before we consider running a local language model.

## Current baseline

The project already has:

- Google and GitHub OAuth sign-in, organizations, role-based access, invitations, and GitHub App installation access.
- GitHub repository listing and source browsing, immutable-commit scans, scan history, coverage/error reporting, and bounded temporary workspaces.
- Semgrep with twelve project-owned rules, Bandit, local credential-pattern checks, and optional npm lockfile advisory checks through OSV.
- Finding provenance, deterministic deduplication, heuristic risk factors, review decisions with reasons/history, scan comparison, and JSON/SARIF export.
- NVIDIA-hosted Nemotron assistance, retrieval over an approved shared knowledge corpus, proposal/diff validation, and optional owner/admin draft pull requests.
- Opt-in weekly/monthly repository automation and signed GitHub event handling, subject to external GitHub App and deployment configuration.

The main implementation references are [README.md](README.md), [the implementation record](docs/IMPLEMENTATION_2026-10-20.md), [the product roadmap](docs/PRODUCT_ROADMAP.md), [the scanner baseline](docs/SCANNER_BASELINE_V1.md), and [the deployment configuration](vercel.json).

## Product rules

1. Keep NVIDIA hosted inference as the AI provider for the current roadmap. Store `NVIDIA_API_KEY` only in the backend environment or deployment secrets; never expose it through frontend code or a `VITE_` variable.
2. Do not start local-LLM work until every preceding phase is complete and its exit checks pass. Local inference is the final, separate phase.
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
- [ ] Add browser journeys for the real UI/API contract. The 64 passing Playwright journeys exercise UI contracts with mocked provider/API responses; fresh-account OAuth and cross-account GitHub App installation still require a non-owner test account. Production owner sign-in, repository listing, MongoDB-backed API health, and a completed scan have been smoke-tested separately.

**Exit check:** a new user can connect an authorized repository, understand exactly what was scanned, review a result, recover from a missing repository or failed scan, and distinguish an advisory from a confirmed scanner result.

### Phase 2 — Decide and implement repository intake and scanner scope

- [ ] Keep GitHub App installation as the first supported source and test installation selection, access changes, revocation, rate limits, and large repository behavior. Deterministic coverage verifies authorized installation selection, clear recovery after GitHub reports a removed installation, cached-installation cleanup, and transient-error preservation. Real cross-account revocation, GitHub rate limits, and large repositories remain external checks.
- [x] Decide whether ZIP upload and arbitrary repository URL import are required for the first beta. Deferred both: GitHub App installations remain the only intake source until ownership checks, URL validation, bounded extraction, secret handling, cleanup, and access controls are designed and tested.
- [x] Decide whether the first beta requires Trivy. Deferred it; current source scanning does not include container or artifact coverage, and adding it needs a separate target definition, versioned adapter, and coverage tests.
- [x] Decide whether the first beta requires OWASP ZAP. Deferred it; network-active DAST needs explicit target authorization, request limits, isolation, and a separate user workflow.
- [x] Set first-beta dependency coverage to optional npm lockfile v2/v3 advisories only. Keep other ecosystems deferred until they can be validated and retain the existing opt-in disclosure of package names and versions sent to OSV.
- [ ] Build an independently reviewed benchmark for supported languages/rules and report precision/recall only when measured. Synthetic fixtures prove regressions, not production detection rates.

**Exit check:** every source and scanner shown in the product is implemented, tested, bounded, and accurately described; unsupported or optional coverage is visible.

### Phase 3 — Strengthen finding identity, correlation, and risk

- [ ] Preserve scanner-specific evidence and provenance while correlating only findings with defensible evidence that they describe the same issue.
- [ ] Measure current false merges and duplicates against reviewed repositories before introducing fuzzy or weighted cross-scanner correlation.
- [ ] Decide whether to add a canonical vulnerability record separate from scan-specific evidence. If added, define lifecycle, organization/repository scoping, history, and migration behavior.
- [ ] Review the current path/CWE-based risk heuristics with security reviewers. Keep the factors and their limits visible; do not imply the score is exploit probability or CVSS.
- [ ] If replacing the score with the proposed M4 model, define reproducible factor inputs (attack surface, reachability, authentication, exploit complexity, and business context), version the formula, backtest it, and preserve historical score provenance.
- [ ] Keep fixed/new/persistent comparisons conservative when scanner success, rules, tool versions, or covered files differ.

**Exit check:** a reviewer can trace every issue to original scanner evidence and understand why it was grouped and prioritized.

### Phase 4 — Build a controlled remediation and verification pipeline

- [ ] Add structured, versioned remediation guidance for known issue types before relying on AI for every fix. Keep any deterministic rule result distinguishable from an AI proposal.
- [ ] Keep AI patch suggestions pinned to the finding's source commit and constrain them to a single, bounded file change unless a reviewed workflow explicitly supports more.
- [ ] Before applying patches or running tests, design a per-job isolated runner with an unprivileged identity, no ambient secrets, restricted/no network, CPU/memory/time/disk limits, cancellation, and guaranteed cleanup.
- [ ] Apply a reviewed patch only in that temporary workspace/branch. Never change the repository default branch automatically.
- [ ] Add verification records for patch integrity, syntax, allowed tests, and a security rescan. Record each check as passed, failed, skipped, or unavailable; do not treat skipped checks as success.
- [ ] Reopen the issue when post-patch evidence still detects it or when verification fails. Preserve the original and post-patch evidence.
- [ ] Keep draft PR creation explicitly reviewed, permission-gated, base-SHA checked, and separate from merge/auto-apply behavior.

**Exit check:** no patch is described as fixed until the configured verification requirements pass, and every skipped or failed check is visible.

### Phase 5 — Complete reporting, audit, and team workflows

- [ ] Decide whether the product needs dedicated report generation beyond current dashboard history and JSON/SARIF exports. If so, define report contents and provenance before implementing it.
- [ ] Add an append-only audit trail for security-sensitive actions such as installation changes, scan starts/cancellations, access changes, reviews, AI consent, patch proposals, and PR creation.
- [ ] Add in-app notifications and preferences only after event types, recipients, deduplication, retention, and failure handling are defined. Add email delivery only with an explicit provider and delivery-status flow.
- [ ] Complete account/organization export and deletion, retention periods, invitation delivery, ownership transfer, and membership lifecycle handling for a private beta.
- [ ] Ensure current unresolved findings are distinct from historical scan totals and that partial/failed scans cannot silently resolve findings.

**Exit check:** users can reconstruct who did what and when, receive useful actionable updates, and understand how their code and records are retained or deleted.

### Phase 6 — Harden automation and production operations

- [ ] Validate weekly/monthly schedules, due-job recovery, duplicate delivery, cancellation, quotas, lease expiry, worker restart, and stale-queue recovery under realistic conditions.
- [ ] Complete signed GitHub webhook setup and test push/PR event selection, replay/deduplication, default-branch behavior, permissions, and failure recovery before enabling events for customers.
- [ ] Monitor worker heartbeat, oldest queued scan, repeated scanner/provider/database failures, and webhook rejects; alert with sanitized logs and request/scan IDs.
- [ ] Test MongoDB backup restoration, Vercel queue/daemon availability, deployment rollback, session invalidation, and GitHub App uninstall/revocation.
- [ ] Publish privacy, terms, retention, subprocessors, security contact, support, and incident-response information before broad external onboarding.
- [ ] Run independent security review and cross-account beta tests; distinguish real provider tests from deterministic mocks.

**Exit check:** a failure is detected, explained, recoverable, and cannot be mistaken for a successful clean scan.

### Phase 7 — Local LLM evaluation (last)

Start only after Phases 0–6 pass their exit checks.

- [ ] Define the reason to add local inference: privacy, availability, cost, latency, or offline operation.
- [ ] Compare a local model against the current NVIDIA-hosted Nemotron path on the same reviewed evaluation set, languages, prompt versions, and safety checks.
- [ ] Measure quality, citation/source fidelity, patch applicability, latency, memory/GPU needs, operating cost, and failure behavior. Keep scanner verdicts independent of model output.
- [ ] Add local inference behind an explicit provider setting with NVIDIA as the existing supported path and a clear fallback/disable control.
- [ ] Re-run data-flow, privacy, security, and deployment reviews before enabling it for users.

**Exit check:** local inference is optional, demonstrably useful, resource-supported, and does not reduce the reliability or transparency of the existing NVIDIA-backed experience.

## Overall completion definition

The project is ready to move beyond a demo when Phases 0–6 pass their exit checks on a production-like environment with at least one account that is not an administrator of the app, and the product clearly reports its supported repositories, scanners, coverage, verification limits, and data handling. Local LLM work remains last and is not a prerequisite for a dependable product.

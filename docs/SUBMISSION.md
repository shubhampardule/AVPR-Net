# Technical submission summary

SecurePatch (repository AVPR-Net) helps developers scan authorized GitHub code,
prioritize findings and review proposed fixes. Production is available at
https://avpr-psi.vercel.app/. The application is static analysis plus hosted AI
assistance; it is not a trained network detector.

For the current implementation boundary and service/data flow, see the
[current architecture reference](CURRENT_ARCHITECTURE.md). The separate v1.0
specification archive describes proposed target capabilities and is indexed
in [the archive status page](SPECIFICATION_ARCHIVE.md).

React/Vite and Express deploy under one Vercel domain. MongoDB stores sessions,
organizations, evidence and review decisions. Vercel Queues and an unprivileged
cloud daemon perform bounded, immutable-commit scans. Local operation can use
BullMQ/Redis instead. Semgrep uses twelve project-owned versioned baseline rules;
Bandit analyzes Python. Credential-pattern checks omit matched values, and optional
npm lockfile advisory matching uses OSV. Coverage and failures remain visible.

Nebius Token Factory serves inference with NVIDIA open-source models (such as
nvidia/Nemotron-3_5-Lightning) for advisory evidence explanations and patch proposals,
backed by 2048-dimensional embeddings for an approved shared security corpus. The API
validates schemas/citation IDs, keeps scanner scores separate from AI opinion, and enforces
an automated credit guardrail (capped at promotional budgets like $25) to strictly avoid overages.


Users can inspect paginated history/findings, compare compatible scans, review or
dismiss issues with a reason, export JSON/SARIF, and draft a finding-specific fix.
A patch must apply to the exact scanned file before a reviewed draft PR can be
created. PR write permissions and signed webhook configuration require explicit
external App setup. Weekly/monthly schedules are opt-in. No default branch update,
automatic merge or arbitrary project test execution is performed by this service.

Verification includes deterministic backend/frontend tests, actual offline scanner
fixtures, isolated Mongo transaction/concurrency/index checks and production
smoke checks. CI runs tests, builds, production audits and browser fixture flows.
Mocked tests are not represented as live OAuth/provider verification. See the
implementation record and CI for the current release's exact validation results.

The last recorded nine-workflow live AI suite completed 8/9 structured responses;
the failed C case passed a separate rerun. Valid source IDs do not prove semantic
citation accuracy. C/C++/Bash/diff syntax and generated-code behavioral tests are
not provided. Trial-provider data minimization is best effort. Review all proposals
independently and consult the actual event rules before claiming eligibility.

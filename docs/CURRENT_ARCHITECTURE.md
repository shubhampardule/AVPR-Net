# AVPR-Net current architecture

**Status:** implementation reference for the current repository. This describes the code and deployment configuration, not every capability in the proposed v1.0 specification archive. See [the archive status and index](SPECIFICATION_ARCHIVE.md) and [the ordered product plan](../plan.md).

## Product boundary

AVPR-Net scans authorized GitHub source at a pinned commit, records and prioritizes scanner findings, and lets organization members review evidence and proposed changes. It is a static-analysis and review product. It is not a trained neural network detector, packet-capture system, general dynamic scanner, or automatic patching service.

## Runtime architecture

```text
Browser (React/Vite)
  └─ same-origin /api/* requests
       └─ Express API (/api/v1)
            ├─ MongoDB: users, sessions, organizations, scans, findings, review state, audit events, notifications
            ├─ GitHub OAuth and GitHub App API: identity and authorized repository access
            ├─ Vercel Queue in production
            │    └─ scan-worker daemon in bom1
            └─ NVIDIA hosted API for explicitly approved AI assistance
```

Vercel serves the frontend and backend as separate services under one domain. Top-level routing sends `/api/*` to the backend and other public paths to the frontend. The scan worker is a Vercel daemon configured separately from request handling. Production scans use Vercel Queues. In local development, scans use BullMQ when `REDIS_URL` is set and otherwise run through an in-process worker. See [vercel.json](../vercel.json) and [scanQueue.js](../backend/src/queues/scanQueue.js).

## Account and repository access

- Google OAuth and GitHub OAuth authenticate a person. GitHub App installation is a separate authorization that grants the organization access to selected repositories.
- Mongo-backed sessions, organizations, memberships, roles, and invitations provide account and team state.
- The API lists repositories available through the connected GitHub App installation and reads repository metadata, file trees, and file content. Scanning an arbitrary Git URL or uploading a ZIP is not currently supported.
- The registered AVPR-Net GitHub App currently requests read-only repository Contents, mandatory read-only Metadata, and read-only account email. It has no repository write permission, subscribed events, or active webhook. A user must sign in to GitHub and install it from [the installation route](https://github.com/apps/avpr-net/installations/new); the public app details page is informational and does not show the install chooser.
- Current membership roles are owner, admin, and developer. The app's installed GitHub permissions determine whether operations such as creating a draft pull request are available.
- Organization ownership can be transferred only by its current owner to an active admin or developer. The owner must enter the exact organization name; MongoDB updates both roles transactionally, the former owner becomes an admin, and the transfer is recorded in the organization's append-only activity log.

## Scan and finding lifecycle

1. An authenticated organization member requests a scan for a GitHub repository. The backend resolves the branch to an immutable commit SHA, enforces admission limits, and queues a scan.
2. The worker fetches an authorized GitHub archive for that SHA into a bounded temporary workspace. It runs Semgrep with twelve project-owned rules, Bandit when available, and local credential-pattern checks. Optional npm lockfile advisory checks query OSV when selected.
3. Results are normalized, fingerprinted/deduplicated, retained with scanner provenance, assigned heuristic risk factors, and saved as scan-specific findings. Coverage, scanner versions/errors, scanner-policy and rules identities, branch, and commit provenance are recorded.
4. Findings support review as open, acknowledged, dismissed, or resolved with a reason and reviewer history. Known rule IDs include versioned deterministic remediation guidance; unknown rules remain unmapped, and AI proposals are separate. Review proposals use the scanned commit and one bounded source file; validation checks the exact path and context without applying or executing the patch. Verification attempts retain status and hashes without source text, and a syntax failure blocks PR creation. A later scan that redetects a resolved issue creates new open evidence and leaves the old review untouched. Compatible scans can be compared; the app offers paginated history/findings and JSON or SARIF export.
5. The dashboard labels organization-wide finding totals and risk distribution as historical. Current unresolved counts, priority findings, and the organization Findings page use the latest completed scan per repository that ran at least one scanner without scanner errors. A newer partial, failed, or in-progress scan leaves the earlier complete result in place with a warning; repositories without a successful baseline are excluded. A separate report builder is deferred for beta; dashboard status and portable JSON/SARIF scan exports cover the current reporting need.

6. Terminal scan outcomes create in-app notifications for active organization members who have not disabled their own scan-results preference. Notices distinguish completed, partial-coverage, and failed scans; canceled scans do not notify. A unique recipient/scan/event key makes delivery idempotent, and MongoDB TTL expires records after 90 days. Notification writes are best effort and never determine scan status; scan history remains authoritative. Email is not configured. See [the notification policy](NOTIFICATIONS.md).

Risk is a prioritization heuristic: 40% scanner severity, 25% CWE-bucket exploitability, 15% occurrence, and 20% file-path business-impact category. It is not a probability or CVSS score. Deduplication is limited to the same scanner, rule, path, CWE, and location; reports from separate scanners remain distinct until an independently reviewed benchmark validates cross-scanner grouping. Findings remain scan-specific; no canonical vulnerability lifecycle record is stored.

The scan worker analyzes source files; it does not run repository programs, package installation scripts, or project test suites. Temporary workspaces are cleaned up. A missing or failed scanner must remain visible as partial coverage or a failed scan rather than being presented as a clean result.

## AI-assisted review

The backend uses the NVIDIA-hosted Nemotron chat and embedding models. An operator allowlists the shared retrieval corpus in `backend/knowledge/sources.json`; the local index is bounded and is not a private per-customer knowledge store. For organization data, hosted AI is subject to the organization setting and the member's evidence-preview consent flow. Evidence minimization is best effort and cannot guarantee removal of every secret or private detail.

AI explanations and code/diff suggestions are advisory and separate from scanner verdicts. The app can validate that a bounded, single-file diff applies exactly to source at the scanned commit and run syntax checks supported for that language. C, C++, Bash, and general unified-diff syntax checking have limitations. Project tests are not executed. An owner/admin may create a draft PR when the GitHub App has the necessary write permissions and the default branch still matches the scanned commit. The service does not update the default branch or merge a PR.

No local LLM is part of the current runtime. NVIDIA-hosted inference remains the chosen provider until the earlier product and reliability phases in [plan.md](../plan.md) are complete.

## Persistence and API organization

Mongoose application models cover `User`, `Organization`, `OrganizationMember`, `OrganizationInvitation`, `Scan`, `Finding`, `AuditEvent`, `Notification`, `RemediationVerification`, `RepositoryAutomation`, `UsageBucket`, and `AssistantCache`. MongoDB also stores Express sessions. Repository access is fetched through GitHub rather than stored as a first-class repository record. Automation settings combine recurring scan frequency and GitHub event preferences.

The API is grouped into health, auth, organizations, members/invitations, audit events and notifications, GitHub, scans, dashboard, AI assistance, and automation/webhooks. Scan routes include scan history/status, findings, comparisons, exports, review decisions, source retrieval, diff validation, append-only remediation verification records, and guarded draft PR creation. Draft PRs are created only on a new proposal branch after the diff matches the single pinned source file, the default branch still matches the scanned commit, the user explicitly acknowledges the unexecuted tests, and the GitHub App has both required write permissions. AVPR-Net checks the base again immediately before opening the PR; a moved base causes cleanup of the proposal branch. Each successful validation and draft PR stores check statuses and source/patch/result hashes without code; an invalid patch records the integrity failure and skips dependent syntax checking. Patch validation is capped at 60 attempts per organization per hour. Tests and post-patch rescans are explicitly unavailable until an isolated runner and proposal-branch scanning are deployed. No merge or default-branch update path is exposed. The audit log records organization, scan, review, GitHub installation, membership (including ownership transfer), invitation, hosted-AI settings and consent, and draft-PR actions. Owner/admins can read recent events; application-level model hooks reject updates and deletes. Failed audit writes are logged and set `X-SecurePatch-Audit-Recorded: false` on the action response. Notification endpoints list the current member's organization notices, unread count, and preference, and allow that member to mark notices read or update their own preference. Delivery is idempotent and best effort; the worker logs sanitized failure details without changing scan status.

## User-facing surfaces

Owners/admins can download the organization JSON export from Settings. It includes membership and invitation metadata, repository automation settings, scan/finding summaries and review history, audit events, and remediation verification records. It excludes repository source files, dedicated evidence snippets, raw scanner stderr, OAuth/session credentials, provider account IDs, GitHub installation IDs, and invitation token hashes. Successful exports create an `organization.exported` audit event. Exports above 25,000 records fail explicitly rather than returning partial data; exports are assembled from live records and are not transactionally consistent snapshots.

Active non-owners can leave an organization from Settings after confirming its exact name. The membership is suspended transactionally and an active owner must remain; owners must transfer ownership before leaving. The departure is audited.

The React app includes the public home and login, dashboard, GitHub/repository views, scan and file views, organization settings with a recent security activity panel for owners/admins, findings, invitation acceptance, and AI assistant. The finding review flow shows recent remediation verification checks and their unavailable/failed states. A notification center in the signed-in dashboard header lists scan outcomes, supports read state and a personal scan-results preference, and provides a retry path when the feed cannot load. There is no full report-builder screen.

## Planned, deferred, or externally gated

- Deferred for the first beta: ZIP and arbitrary repository URL import. GitHub App installations remain the only source until ownership checks, validation, bounded extraction, secret handling, cleanup, and access controls are designed and tested.
- Deferred for the first beta: Trivy artifact/container scanning and OWASP ZAP dynamic testing. They need separate scope, safe execution or network controls, and coverage tests before users can rely on them.
- Optional dependency advisories currently support npm lockfile versions 2 and 3. Other ecosystems remain deferred; enabling the check sends package names and versions to OSV.
- A separately persisted canonical vulnerability model and the proposed M3/M4 correlation and risk designs.
- Structured remediation-rule management, safe patch application or project test execution in an isolated per-job runner, and post-patch security rescanning. The proposed runner boundary and release tests are documented in [the isolated-runner design](ISOLATED_RUNNER_DESIGN.md); no repository code is currently executed. Draft-patch verification outcomes are persisted with check statuses and hashes, but unavailable checks remain visible until these execution capabilities are deployed.
- Full report generation beyond dashboard history and JSON/SARIF exports; an audit export with history pagination in the UI; audit coverage for authentication, webhook, and failed-action attempts; email notifications and durable notification delivery/outbox.
- Scheduled scans and signed push/PR events require a healthy worker; event scans additionally require a configured webhook secret and GitHub App subscriptions. Draft PRs require approved GitHub write permissions.
- Local LLM support is a final planned evaluation, not current functionality.

See [implementation and verification details](IMPLEMENTATION_2026-10-20.md), [scanner scope and limitations](SCANNER_BASELINE_V1.md), [AI data controls](AI_DATA_CONTROLS.md), and the [private-beta roadmap](PRODUCT_ROADMAP.md) before making release or coverage claims.

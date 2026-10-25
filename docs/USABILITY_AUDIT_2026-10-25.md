# Usability audit — 25 October 2026

This audit covers the local changes after production revision `6cf4512`.
It does not certify every external account, repository, or deployment scenario.
The source-window fix is in local commit `97f1a6e`; the follow-up fixes below remain
local until explicitly released. No production configuration was changed in this audit.

## Problems reproduced and corrected

- Large affected files returned a size error that the source endpoint misleadingly
  reported as an assistant configuration/index failure. Review now loads an exact,
  bounded excerpt from the scanned commit, displays its real line range, and reports
  actionable source errors. Full-file integrity checks and rescans remain full-file.
- Asking NVIDIA to repeat an entire excerpt caused malformed/truncated responses.
  Excerpt reviews now request at most five exact, unique before/after replacements.
  The application constructs and maps the diff; ambiguous, overlapping, malformed,
  no-op and ungrounded responses remain rejected. No schema or citation gate was relaxed.
- A comparison response could arrive after another scan was selected and appear
  under that scan. Responses now match the selected scan and request revision.
  Comparison and cancellation also expose pending states and prevent repeated clicks.
- A late notification response could replace another workspace's badge. Notification
  state now remounts with the workspace, and stale reads cannot undo saved read or
  preference changes. Delayed-response regression journeys cover these cases.
- Raster files reached a placeholder instead of a preview. The file-view endpoint
  now returns bounded, signature-checked raster data. SVG remains escaped source;
  corrupt/unsupported images have a GitHub fallback, pinned to the selected ref.
- Copying a proposal had no success feedback. It now confirms copying and retains
  the download fallback when clipboard access fails.
- Assistant copy claimed all execution was disabled despite separately approved
  repository tests. The disclosure now distinguishes AI requests from test approval.
  Missing NVIDIA configuration disables requests and explains the recovery path.
- Follow-up live inspection caught misleading disconnected/unavailable labels while
  repository access and branch metadata were still loading. Initial checks now say
  they are loading; a failed status check is distinct from a disconnected account.
- A delayed-response browser test reproduced editable proposal inputs during an
  in-flight model request. Language, mode, request, source, finding ID and knowledge
  query now remain fixed while the request is pending, then become editable again.

## Control coverage

The browser journeys run the actual local frontend with deterministic API fixtures.
They exercise interactions and error recovery, but do not perform fresh provider login.

| Area | Controls and states exercised |
| --- | --- |
| Public pages | Desktop/mobile navigation, anchors, logo, theme persistence, sample scenarios, sample patch views, copy, final CTA, minimal footer |
| Sign-in and invitations | Both OAuth handoff URLs, return links, missing/expired/accepted invitations, signed-out recovery |
| Workspace | Selector, creation, refresh/retry, mobile navigation, current versus historical findings, missing complete baselines, sign-out failure/retry |
| Repository access | Installation selection, connect/revoked states, add-repository dialog, focus trap/Escape, access-management links, refresh on return without sign-out, stale-list recovery |
| Repository files | Folder navigation, pinned source, copy/fallback, raster preview, inert SVG, corrupt image fallback, missing path and retry, GitHub link |
| Scans | Start/cancel, dependency-sharing opt-in, loading/history/selection, commit details, incomplete coverage, refresh recovery, exports, comparison, risk filters and pagination |
| Findings | Current-baseline disclosure, filtering, pagination, exact file/line links, review reason/history, persisted decisions, stale-data recovery |
| Assistant | All workflows, examples/evidence, per-request consent, sanitized preview, malformed input, source autofill/retry, real excerpt offsets, before/after, copy/download, patch validation, rejected-proposal feedback, draft-PR acknowledgement and syntax refusal |
| Settings | Section links, members/roles, invitations/copy/revoke, email status distinctions, hosted-AI preference, audit history/failure disclosure, export/retry, ownership transfer, leaving, guarded account/workspace deletion |
| Notifications | Open/Escape/outside close, exact scan link, read/all-read, preferences, retry, narrow layout, theme, workspace isolation and delayed-read protection |
| Automation | Per-event readiness, disabled unavailable triggers, supported schedule selection, disabling an existing event after configuration loss |

## Evidence

- Backend: **612 tests across 75 suites passed**.
- Frontend: **42 unit tests across 10 files passed**; production build passed.
- Browser: **102 local journeys passed** with mocked APIs, including delayed
  responses, permissions/refusals, retry paths, mobile controls and source review.
- Deployment bundle generation and packaged proposal/scanner-fingerprint check passed.
- Production dependency audits: **zero reported vulnerabilities** in each service.
- Tracked-file credential-pattern check and whitespace checks passed.
- Real Atlas acceptance: **44 disposable database/HTTP/process checks passed**;
  generated fixture database cleanup completed. Identity, scanner/download and enqueue
  boundaries are substituted where documented by the acceptance tool. No application
  account was deleted and no invitation email was sent.
- Real GitHub installation reads loaded default-branch trees and pinned README files
  for all four authorized repositories. All **82 findings across 22 source files** in
  the previously failing scan loaded source windows through the local fixed service.
  Customer source was not sent to NVIDIA during those reads.
- Live NVIDIA chat and embeddings passed. Separate synthetic JavaScript (67,953-byte
  file) and Python (66,559-byte file) excerpt reviews produced patches that applied to
  the full source, preserved surrounding content and passed syntax checks. These were
  parser checks, not execution of generated code or proof of remediation correctness.
- Operations check returned healthy worker status and no current alerts.
- Edge reconnected during the follow-up. On the existing signed-in owner account,
  production checks confirmed the four-repository list, access refresh with explicit
  success feedback and no sign-out, pinned file navigation/content, scan history and
  coverage details, the no-previous-scan comparison explanation, finding expansion
  and review-history availability, small-file source autofill, settings/activity,
  notifications and findings pagination (83 findings, four pages). No account,
  membership, repository content or review decision was changed, and no AI request
  was submitted through the production browser during these checks.

## Remaining acceptance and configuration limits

- GitHub App API reports no event subscriptions; webhook configuration is unavailable
  and the local webhook secret is missing. Push/PR-triggered scans are **not ready**.
  The UI's disabled state is tested; actual event delivery still needs configuration
  and end-to-end acceptance.
- A fresh, independent user's Google/GitHub OAuth, installation and scan journey has
  not been rerun in this audit. Mocked handoff tests and owner installation reads do
  not replace that acceptance.
- Edge initially failed with **Debugger unattached**, then reconnected. The scoped
  owner-account production checks above passed. This is not independent-account
  acceptance or a production check of the unpublished fixes; the original large-file
  source-loading failure was still visible on the old production revision.
- Actual invitation inbox delivery, provider redelivery and production recovery
  drills remain unverified. Disposable integration checks do not certify them.
- Hosted repository tests support the documented bounded npm profile, not arbitrary
  languages/frameworks. Earlier fixture PR/test acceptance belongs to its recorded
  release; it is not evidence for a new unpublished revision.
- These local fixes require a release before the production source-loading problem
  is corrected. On release, pin the hosted test runner to the exact new main revision,
  pass hosted contracts, and verify the affected production flows.

Do not close the broader R01–R17 roadmap packages solely from these test counts.

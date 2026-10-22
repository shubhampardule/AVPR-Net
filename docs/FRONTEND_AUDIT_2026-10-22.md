# Frontend consistency audit — 2026-10-22

Status: implemented and checked locally. No GitHub commit or push. Existing backend and account-lifecycle work is preserved.

## Shared design rules

- One neutral surface palette and one blue action/selection accent, sourced from theme variables. Both public and authenticated screens use these tokens.
- Separate semantic colors for critical, high, medium, low/completed, and informational states. Scanner severity and calculated risk have explicit labels.
- Removed broad light-mode class-substring overrides. Components now use semantic utility tokens directly; provider logo colors remain unchanged.
- Shared workspace content width, padding, heading sizes, corner radii, form foregrounds, placeholders, and visible focus styles. Visible labels use at least 11px in the audited views.
- One main landmark and one primary heading per route. Public and workspace skip links are available. Browser titles describe the current page, and page navigation resets scroll position.
- Current repository navigation remains selected on nested repository, scan, and source routes. Assistant and repository breadcrumbs identify the actual screen. Account identity appears once in the workspace shell.

## Page audit

| Page | Corrections |
| --- | --- |
| Home | Removed the duplicate hero findings example. Retained one interactive finding/patch example. Replaced repeated capability cards with actual scanner coverage and limits. Unified surfaces and action colors. |
| Sign-in | Unified surfaces, provider-button treatment, and action contrast across themes; retained OAuth return paths and error/deleted-account messages. |
| Invitation acceptance | Applied shared palette, focus treatment, and action colors. Existing missing-token, signed-out, expired, and accepted-state journeys remain covered. |
| Overview | Normalized width, heading weight, spacing, metrics, statuses, and low-risk color; retained the distinction between historical and current findings. |
| Repositories | Removed the repeated access eyebrow/description. Page heading now matches navigation. Repository actions describe browsing; access wording no longer implies all App permissions are read-only. |
| Repository | Removed three repetitive metadata cards and the redundant connected badge. Kept branch metadata, the file browser, scan action, and automation controls. Consolidated duplicate error displays. |
| Source file | Removed repeated path text from the code toolbar. Long paths wrap. Missing paths/workspaces stop loading with guidance; failed requests have a working retry. |
| Security scans | Standardized page spacing, controls, status colors, and finding labels; retained scan provenance, coverage, exports, and comparison/review workflows. |
| Findings | Standardized page layout and card colors. Explicitly distinguished scanner severity from calculated risk; retained review reasons/history, pagination, and source/assistant links. |
| Workspace settings | Added section navigation; moved ownership/leave/deletion controls below routine team, privacy, and data tasks. Invite copying now confirms success. Detailed deletion consequences appear during confirmation. |
| AI assistant | Removed duplicate signed-in branding and the marketing headline. Added a task-focused title. General data-use information is expandable; per-request preview and consent remain visible and mandatory. |
| Assistant demo | Retained its standalone brand/theme header and sample-data labeling; used the same design system. This route remains development-only. |
| Not found | Applied the same surfaces, typography, focus, and return-home action as the rest of the site. |

## Interaction and accessibility fixes

- Repository-access dialog has an accessible name, modal semantics, keyboard focus containment, Escape dismissal, focus restoration, mobile height limits, and background-scroll locking.
- Repository automation reports save success, supports retry after loading errors, and disables edit controls for members without management permission.
- A numeric risk score of zero no longer labels an issue resolved. Resolution still requires its separate review state.
- Removed body overflow clipping so responsive tests detect actual page overflow rather than masking it.

## Verification

- Production Vite build passes.
- Frontend unit tests: 6 files, 16 tests pass.
- Full browser regression suite: 83 journeys pass. The six journeys affected by the final readability/recovery changes were run again and pass.
- Visual matrix: 12 production-build routes at 1440×900 and 390×900, in dark and light themes (48 views). The standalone development assistant adds 4 views, for 52 total. Final readability edits received a targeted matrix rerun.
- Matrix checks: page overflow, JavaScript page errors, actual selected theme, main/heading counts, and visible text below 11px. A computed-color text-contrast check also ran on the sampled visible text; this is a diagnostic, not a formal accessibility certification.
- Keyboard regression journeys cover dialog focus/Escape/return, settings section targets, current sidebar location, file recovery, and copied/saved feedback.
- Screenshots and the diagnostic report are stored under `.local/frontend-audit/` (ignored local artifacts).

The browser journeys and visual matrix use deterministic mocked account/provider/API responses. This audit does not establish fresh-account OAuth, live cross-account repository authorization, every possible dataset, or production deletion correctness. Those remain tracked separately in plan.md. The live site has not been updated.

## Homepage review follow-up

- Removed the duplicate repository action from desktop and mobile headers; the hero retains the single “Connect a repository” link.
- Removed the footer branding, repeated section links, and extra sign-in link. The footer is a compact copyright line.
- Preserved the pixel robot artwork and mapped its colors to the blue brand palette. Both the site mark and SVG favicon switch with the saved theme, including on reload.
- Rechecked production build, all 16 frontend unit tests, all 12 public browser journeys, and 8 rendered home/sign-in views across desktop/mobile and dark/light. No overflow, page errors, or heading/main-count regressions were detected. Provider responses remain mocked for these checks.
- Changes remain local; no commit, push, or deployment was performed.

Light-mode follow-up: applied warm ivory surfaces through the shared background tokens (#F8F6F2 primary, #FFFDF9 secondary, #F3F0EA elevated, #EBE7DF subtle). Production build and three theme/notification browser checks pass. Home and settings were rendered at desktop/mobile sizes in both themes; no overflow, page errors, or sampled contrast issues were detected.

Palette refinement: replaced ivory with nearly neutral stone surfaces (#F6F6F5, #FDFDFC, #EEEEED, #E6E6E4) to harmonize with the existing blue accents while retaining a slight warmth. Restored the robot's original tonal contrast with a hue-only palette adjustment. Changes remain local.

Pattern backgrounds: homepage grid shares 48px desktop / 32px mobile spacing, 1px strokes, positioning, and fade in both themes. Sign-in uses a restrained Steel Blue radial in dark mode and Soft Blue Radial in light mode, with shared responsive ellipse dimensions and opaque form surfaces. Production build, four public interaction journeys, and eight home/login rendered views pass. Desktop hero dimensions match exactly across themes (1440 by 356.4375px at the checked viewport). No push or deployment.


## AVPR-Net branding and invitation-email follow-up

The displayed product name is now AVPR-Net across the shared wordmark, header/home accessibility labels, footer, loading/error states, route/document titles, sign-in and invitation screens, and finding/repository/assistant copy. Existing session, preference and HTTP-header identifiers remain compatible. The approved robot shape and current theme palette are preserved.

Settings now exposes an unchecked email-invitation option only when the backend reports that delivery is configured. Provider-accepted, failed and uncertain outcomes have distinct copy, and all retain the manual link. Three browser journeys verify those outcomes and explicit send opt-in. The older claim that anyone with an invitation link could accept was corrected to require the invited verified email.

The complete browser suite passed 86 journeys before branding. The final AVPR-Net run also passes all 86 journeys; see the implementation record. Two stale browser assertions were corrected for the precise repository heading and invitation copy. Frontend unit checks pass all 16 tests; production build passes. Parallel test execution across all suites exceeded local process deadlines; verification was rerun sequentially rather than treating interrupted runs as passes.

Final branding and optional-email visual check: 12 rendered home, sign-in, and settings views across desktop/mobile and both themes pass. The optional email checkbox is enabled in the mocked visual fixture; no real mail is sent. No overflow, page errors, or sampled text-contrast flags were found.

Release-candidate history: frontend and AVPR-Net branding are committed as fae2bd8 with author Patil-26 <atharvappatil2607@gmail.com>. Earlier statements that changes were uncommitted describe those earlier audit steps. Production release remains pending.

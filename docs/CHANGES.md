# Changed-file inventory

This directory has no Git metadata, so no Git diff/history claim is possible.
This inventory covers files intentionally created or changed during this work.
Original scanner adapters, scan worker, MongoDB finding schema, normalization,
deduplication, occurrence and weighted risk implementation were preserved.

## Documentation and evidence

- `README.md`: actual purpose/architecture, setup, configuration, commands,
  existing-app demo, API surface, privacy, attribution and limitations.
- `SETUP.md`: links/current assistant status and corrected original prerequisites.
- `docs/NVIDIA_HACKATHON_PLAN.md`: baseline audit, phase decisions/results and
  precise Definition of Done status.
- `docs/NVIDIA_PROVIDER.md`: provider contract, defaults, diagnostics and official
  model/API/terms references.
- `docs/DEMO.md`: both repeatable scenarios, commands and outage/offline fallback.
- `docs/EVALUATION.md`: methods, baseline/regression results, both live runs and
  measurement limits.
- `docs/SUBMISSION.md`: concise technical submission evidence and outstanding checks.
- `docs/CHANGES.md`: this inventory.
- `docs/evaluation/live-v1.json`, `docs/evaluation/live-v2.json`: intentionally
  retained small metadata-only measured reports; no secrets or vectors.

## Backend configuration/application integration

- `.gitignore`, `backend/.gitignore`: exclude local indexes/evaluation artifacts.
- `backend/.env.example`: documented NVIDIA settings and limits.
- `backend/.env`: ignored local settings created at the user's request; user
  supplied the key locally. Only the header deadline was subsequently tuned.
- `backend/package.json`, `backend/package-lock.json`: diagnostic, indexing,
  assistant, demo and evaluation scripts; direct @babel/parser 7.29.9 dependency;
  regenerated lockfile repairs the baseline clean-install failure.
- `backend/jest.config.js`: exclude generated local artifacts from test/module discovery.
- `backend/src/config/nvidia.js`: optional validated centralized provider settings.
- `backend/src/config/env.js`: explicit local-demo flag; original database
  requirement remains in normal mode.
- `backend/src/app.js`: conditional existing-app demo routes/session setup,
  bounded JSON bodies, request IDs, existing localhost CORS plus IPv4 localhost.
- `backend/src/server.js`: skip database only in explicit demo mode and bind that
  mode to loopback; normal scanning startup remains the default.
- `backend/src/controllers/health.controller.js`: additive configuration-only AI status.
- `backend/src/routes/index.js`: authenticated organization-scoped assistant mount.
- `backend/src/routes/assistant.routes.js`: shared service routes, real finding
  organization lookup, synthetic demo restrictions, usage/concurrency controls.
- `backend/src/routes/demo.routes.js`: only health/shared AI routes in explicit demo mode.
- `backend/src/middleware/errorHandler.js`, `httpLogger.js`: safe error/body-limit
  handling and metadata-only logs without raw bodies/query strings.

## Backend services, operator commands and fixtures

- `backend/src/services/nvidia.service.js`: injected hosted client, deadlines,
  bounded retries, typed safe errors, response/vector validation and logging.
- `backend/src/services/rag.service.js`: approved source collection, redacted
  section-aware chunks, line/hash metadata, exact cosine search, persistent
  atomic incremental index, lock and compatibility checks.
- `backend/src/services/ai-safety.js`: representative text/field redaction and
  system policy establishing untrusted-input boundaries.
- `backend/src/services/ai-output.js`: strict object keys, bounded values and
  server-resolved source IDs.
- `backend/src/services/assistant.service.js`: actual-finding/manual-event
  adapters, advisory analysis and shared multi-language code/review service.
- `backend/src/services/code-validation.js`, `syntax-worker.js`: bounded
  nonexecuting JS/TS and Python AST checks; honest unavailable parser states.
- `backend/src/cli/nvidia-health.js`, `rag.js`, `assistant.js`, `demo.js`,
  `evaluate.js`: operator diagnostics, approved indexing/search, fixture runs,
  existing-server demo entry and mock/live evaluation with retained reports.
- `backend/knowledge/sources.json`: four explicitly approved shared files.
- `backend/knowledge/network-investigation.md`, `secure-coding.md`: original
  defensive guidance with provenance.
- `backend/fixtures/events/{suspicious,benign}.json`: synthetic event inputs.
- `backend/fixtures/code/{python,javascript,typescript,c,cpp,bash,review}.json`:
  defensive generation/review requests.
- `backend/fixtures/retrieval.json`: five known expected-source queries.
- `backend/fixtures/README.md`: origin and expected behavior/measurement scope.

## Tests

- `backend/tests/nvidia.test.js`, `rag.test.js`, `assistant.test.js`,
  `code.test.js`, `assistant-routes.test.js`, `ai-security.test.js`: provider,
  persistence/retrieval, analysis/output, parser/code, access and privacy tests.
- `backend/tests/__mocks__/env.js`: test-only settings, no real service credentials.
- `backend/tests/auth.test.js`, `health.test.js`: explicit existing GitHub mock,
  test settings, queue mock and test session secret; existing assertions retained.

## Existing frontend

- `frontend/src/pages/Assistant.jsx`: evidence/code/review/knowledge workflows,
  original inputs, citations, validation states and limitations; context changes
  cancel/ignore stale requests.
- `frontend/src/App.jsx`: integrated assistant and local-demo routes.
- `frontend/src/components/navbar/Navbar.jsx`: main-application demo link.
- `frontend/src/components/layout/DashboardLayout.jsx`: assistant navigation.
- `frontend/src/components/ui/FindingCard.jsx`: explain an authorized saved finding.

No source tree was replaced. No model weights, second web framework, vector
service or autonomous agent framework was added. Generated dependencies, build
output, vectors and detailed synthetic response artifacts stay ignored. No
commit, push, deployment, generated-code execution or real response action was
performed. Full scanning still requires the original services and credentials.

# Repeatable hackathon demonstration

This demo uses the existing SecurePatch Express/React application, hosted NVIDIA
chat/embeddings and a persistent local shared index. All event and code fixtures
are project-authored synthetic data. No live network attack or production scan
is required. It consumes NVIDIA API quota and needs internet connectivity.

## Clean setup

Use Node 22.23.1/npm 10.9.8 or compatible newer versions. In PowerShell from
the project root:

```powershell
cd backend
npm ci --ignore-scripts --no-audit --no-fund
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
# Edit .env locally and set NVIDIA_API_KEY. Keep an existing .env intact.
npm run nvidia:health -- --live
npm run rag:index
npm test
```

Start the existing backend with `npm run demo`. It binds to 127.0.0.1:5000 and
mounts only health/shared assistant routes. In a second terminal from the root:

```powershell
cd frontend
npm ci --ignore-scripts --no-audit --no-fund
npm run dev -- --host 127.0.0.1
```

Open [the assistant](http://127.0.0.1:5174/assistant-demo), or follow **AI assistant**
from the existing landing-page navigation. Do not start another backend on the
same port. The normal `npm start` remains the authenticated scanner application.

## Story A — investigate, then propose a defensive utility

1. Open **Investigate** and load **Suspicious fixture**. Show the original JSON:
   120 failed SSH authentications, zero successful logins, 60-second interval,
   synthetic=true. Explain that this is supplied event analysis; there is no
   network detector in this repository.
2. Select **Analyze evidence**. Show the original evidence alongside the advisory
   severity, possible guessing/automation interpretations, false-positive checks,
   missing information and limitations. Wording/severity may vary between runs.
3. Expand a **Retrieved evidence** item. Show the path, line range, source ID and
   excerpt. Similarity scores express retrieval ranking, not attack confidence.
4. Load **Benign fixture** to discuss the six expected HTTPS monitoring checks
   and why inventory/schedule validation still matters.
5. Open **Code & review**, select Python, and load the built-in request to
   summarize failure counts. Select **Draft proposal**. Show code, source-backed
   guidance, assumptions, suggested tests and the AST parser status. Generated
   code and tests have not been executed, regardless of their contents.

CLI equivalents from backend:

```powershell
npm run assistant -- analyze fixtures/events/suspicious.json
npm run assistant -- analyze fixtures/events/benign.json
npm run assistant -- code fixtures/code/python.json
```

If the original full scanner environment is configured, run a real authorized
repository scan in the normal application and use **Explain with Nemotron** on
a persisted finding. This uses membership-checked, organization-scoped lookup
and preserves scanner severity/risk. The local demo cannot read persisted
findings or run scans. A full authenticated scan was not verified on this machine.

## Story B — multi-language secure input validation and review

1. Open **Code & review**. Select JavaScript and use the port-validation fixture.
   For a short presentation request, use: "Write a tiny pure function validating
   integer ports 1 to 65535. Keep the JSON response concise; suggest three tests."
2. Show retrieved coding guidance, the proposed source and Babel syntax status.
   Point out that a parser does not prove semantics or security. Suggested tests
   can themselves be wrong and need review.
3. Switch to TypeScript or Python and generate using the same service. C, C++
   and Bash are supported proposal languages, but their syntax validation is
   explicitly unavailable in this MVP.
4. Select **Load review example**. Review the proposed unified diff for the
   permissive JavaScript port parser. No file is overwritten; diff parsing and
   unit-test execution are unavailable and labeled accordingly.
5. Open **Knowledge** and search an expected-source query; inspect its excerpts.

CLI equivalents:

```powershell
npm run assistant -- code fixtures/code/javascript.json
npm run assistant -- code fixtures/code/typescript.json
npm run assistant -- code fixtures/code/c.json
npm run assistant -- code fixtures/code/cpp.json
npm run assistant -- code fixtures/code/bash.json
npm run assistant -- code fixtures/code/review.json
npm run rag:query -- "Risk formula severity exploitability occurrence business impact"
```

## Failure and offline fallback

- Missing key, rate limits, deadlines or invalid structured output: UI shows
  unavailable assistance and retains original event/finding evidence. Never call
  this a successful analysis. The normal scanner does not call NVIDIA.
- Empty index: retrieval returns empty; a generated response carries an
  insufficient-context limitation. Failed/stale embedding configuration: rebuild
  with `npm run rag:index -- --rebuild` after reviewing model settings.
- No external connectivity: show original fixtures and inspect the separately
  labeled saved evaluation artifacts under `backend/.local/`. Do not present a
  saved response or mocked evaluation as a new live response. Run `npm run
  evaluate` to exercise deterministic offline orchestration and parser checks.
- Demo request bounds: ten costly requests per minute and two concurrent
  workflows. Wait for the window to expire if the local guard returns 429.

## Evaluation

```powershell
cd backend
npm run evaluate
npm run evaluate -- --live
```

Both commands index only `backend/knowledge/sources.json`. Live evaluation sends
the approved corpus and synthetic tasks to NVIDIA. Latest reports/artifacts are
stored in ignored `.local/evaluation-{mock,live}*.json`; timestamped archives
preserve subsequent runs. A nonzero live-evaluation exit means at least one
workflow failed; inspect its row rather than omit the failure. See EVALUATION.md
for definitions, measured results and limitations.

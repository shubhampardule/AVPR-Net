# AVPR-Net / SecurePatch + NVIDIA Nemotron

SecurePatch helps developers prioritize repository vulnerabilities and review
defensive changes. The supplied folder is named AVPR-Net, while the source and
UI identify the application as SecurePatch. Its existing detectors are Semgrep
and Bandit static analyzers; there is no trained neural model, packet capture or
network detection engine in this repository.

The NVIDIA extension adds source-backed event/finding explanations, defensive
code generation/review in six languages, and persistent retrieval over approved
project guidance. Hosted inference runs on NVIDIA; no local LLM/GPU is required.

Production: https://avpr-psi.vercel.app/

See [audit remediation and new workflows](docs/IMPLEMENTATION_2026-10-20.md) for
current capabilities, resource limits, verification and external setup.
See the [current architecture and shipped-feature boundary](docs/CURRENT_ARCHITECTURE.md)
for the implementation reference. The separate v1.0 specification archive is
indexed as a proposed target in [its status page](docs/SPECIFICATION_ARCHIVE.md).
See the [private beta roadmap](docs/PRODUCT_ROADMAP.md) for the concrete work
needed before teams can rely on SecurePatch beyond an internal pilot.

## Architecture and responsibilities

- **Scanning path:** React -> authenticated Express API -> Vercel Queues in
  production (local BullMQ/Redis when configured, otherwise an in-process
  worker) -> authorized GitHub archive pinned to a commit -> Semgrep/Bandit,
  credential-pattern checks, and optional npm/OSV advisory checks -> finding
  normalization, deduplication, occurrence and heuristic risk -> MongoDB.
  Temporary source workspaces are cleaned up by the worker.
- **AI path:** authorized finding or supplied structured event/code request ->
  best-effort minimization -> NVIDIA query embeddings -> local cosine retrieval
  -> retrieved excerpts and original evidence -> hosted Nemotron chat -> bounded
  schema/citation validation -> reviewable UI result. It never changes the
  detector's result, executes a proposal or deploys a patch.
- **Indexing:** an operator allowlists explicit files in
  `backend/knowledge/sources.json`; section-aware overlapping chunks include
  path, lines, type, language and hash. Passage embeddings/vectors persist in
  ignored `backend/.local/knowledge.json`. Atomic writes, incremental reuse,
  model/chunker compatibility checks and an exclusive lock protect updates.
  This shared nonsensitive corpus is capped at 500 chunks; exact cosine search
  is appropriate for a small private beta, not a large multi-tenant deployment.

Nemotron `nvidia/nemotron-3.5-lightning-30b-a3b` supplies hosted text/code
assistance. `nvidia/nemotron-3-embed-1b` supplies 2048-dimensional retrieval
embeddings using `passage` for indexing and `query` for search. One shared
provider implements deadlines, bounded retries, response validation and safe
operational logging. See [provider details](docs/NVIDIA_PROVIDER.md).

## Run the local NVIDIA demo

Prerequisites: Node 22.23.1 or compatible newer Node, npm, a NVIDIA API key and
internet access. Python 3 is optional for AST-only Python syntax checks. The
synthetic demo uses the existing backend/frontend without MongoDB, Redis or OAuth.

From the root in PowerShell:

```powershell
cd backend
npm ci --ignore-scripts --no-audit --no-fund
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
# Set NVIDIA_API_KEY in backend/.env with your local editor.
npm run nvidia:health -- --live
npm run rag:index
npm run demo
```

In a second terminal from the root:

```powershell
cd frontend
npm ci --ignore-scripts --no-audit --no-fund
npm run dev -- --host 127.0.0.1
```

Open [http://127.0.0.1:5174/assistant-demo](http://127.0.0.1:5174/assistant-demo).
Follow [the two-scenario demo script](docs/DEMO.md). Demo mode binds the API to
127.0.0.1:5000, requires an explicit demo header/approved browser origin, accepts
only synthetic events, exposes no scanning/data-store routes, and refuses
NODE_ENV=production. It is an explicit operator mode in the existing server.

## Configuration

`backend/.env.example` contains all supported settings; `.env` is ignored. Never
put credentials in frontend source, browser storage, or a VITE_ variable.

```dotenv
NVIDIA_API_KEY=
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_CHAT_MODEL=nvidia/nemotron-3.5-lightning-30b-a3b
NVIDIA_EMBEDDING_MODEL=nvidia/nemotron-3-embed-1b
NVIDIA_EMBEDDING_DIMENSIONS=2048
NVIDIA_CONNECTION_TIMEOUT_MS=30000
NVIDIA_RESPONSE_TIMEOUT_MS=60000
NVIDIA_MAX_RETRIES=2
NVIDIA_MAX_TOKENS=2048
```

Optional server variable `AI_LANGUAGES` selects a comma-separated subset of
`python,javascript,typescript,c,cpp,bash`. Configuration-only diagnostics never
call the provider; `reachable: null` means untested. Explicit live diagnostics
send only tiny synthetic text. Each retry may consume additional quota.

## Run the original scanning application

The default `npm start` / `npm run dev` runs the authenticated application and
requires DATABASE_URL, SESSION_SECRET, Google OAuth settings, and GitHub App
settings/private-key path. Redis is optional for local development: without
`REDIS_URL`, the backend runs scans in-process; with it, start Redis and the
standalone worker (`npm run worker` in backend). Full static coverage requires
Semgrep and Bandit on the worker PATH. If a scanner is missing, available
detectors still run and the scan is marked with partial coverage. On Windows,
the scanner worker can run the pinned Linux scanner binaries in WSL. In Ubuntu,
install the same versions used by the production worker:

```powershell
wsl --distribution Ubuntu --exec bash -lc 'python3 -m venv "$HOME/.local/share/securepatch-scanners" && "$HOME/.local/share/securepatch-scanners/bin/pip" install --upgrade pip==26.2.1 setuptools==84.2.0 && "$HOME/.local/share/securepatch-scanners/bin/pip" install semgrep==1.181.0 bandit==1.9.4'
wsl --distribution Ubuntu --exec printenv HOME
```

Set `SECUREPATCH_SCANNER_WSL_DISTRO=Ubuntu` and
`SECUREPATCH_SCANNER_WSL_BIN_DIR=<the printed HOME>/.local/share/securepatch-scanners/bin`
in `backend/.env`, then restart the backend. The worker copies each validated,
temporary repository snapshot into WSL's Linux filesystem for the scan and
removes that copy afterward. Configure OAuth callback URLs to match the local
or production host you use.

For the production deployment, set `FRONTEND_URL` to
`https://avpr-psi.vercel.app` and register these exact callback URLs with the
providers:

- Google: `https://avpr-psi.vercel.app/api/v1/auth/google/callback`
- GitHub OAuth: `https://avpr-psi.vercel.app/api/v1/auth/github/callback`

The callback variables must use the same URLs. Preview deployments need their
own provider callback configuration if you want OAuth sign-in there.

After signing in and selecting an organization, run a scan from a connected
repository. **Explain with Nemotron** links a persisted finding to `/assistant`;
AI requests require both session authentication and active organization membership.
Finding queries are scoped by finding ID and organization. Original scanner
severity and weighted risk remain authoritative. Production uses Mongo-backed
sessions, Vercel Queues and an unprivileged scanner daemon. Google/GitHub sign-in,
repository access and a real scan were verified on the deployment. Public examples
are illustrative; generated code and tests are not executed by the scanning worker.

New workflows include paginated findings, history/comparison, review reasons,
current unresolved issues, JSON/SARIF export, finding-specific review drafts,
exact-source patch checks, reviewed draft PR creation and opt-in repository
schedules/events. PRs require approved App write permissions; signed GitHub
webhooks require their server-only secret and App subscriptions. Those features
remain guarded when external configuration is missing.

## Index, test and evaluate

From backend:

```powershell
npm run rag:index
npm run rag:status
npm run rag:query -- "Repeated SSH authentication failures"
npm run rag:index -- --rebuild
npm test
npm run evaluate
npm run evaluate -- --live
```

From frontend, `npm run build` verifies the production bundle. The indexer reads
only allowlisted supported text/source files and excludes dotfiles, secrets,
dependencies, binaries, build output, symlinks/escapes and oversized files.
Incremental runs reuse unchanged content and remove no-longer-configured sources.
Changing the embedding model, dimensions, endpoint or chunker requires rebuild.
After an interrupted indexer, confirm no indexing process is active before
removing only its `.lock` file. Do not edit or share private vectors/artifacts.

Offline tests use mocks and never call NVIDIA. The offline evaluator uses
artificial deterministic vectors/canned responses and is not a model benchmark.
Live evaluation uses five known-source queries, two events, six languages and
one review, retaining failures in its results. See [measured evaluation](docs/EVALUATION.md)
and [fixture provenance](backend/fixtures/README.md).

## API surface

Normal mode: `/api/v1/organizations/:organizationId/ai`; demo mode:
`/api/v1/ai/demo` with `X-SecurePatch-Demo: 1`.

| Method/path suffix | Input/result |
| --- | --- |
| GET /health | Configuration status, languages, execution disabled |
| GET /knowledge | Index status and approved source metadata |
| GET /fixtures | Built-in synthetic event/code examples |
| POST /retrieve | `{query}` -> source excerpts and similarity |
| POST /analyze | `{event}` or normal-mode `{findingId}` -> original evidence plus advisory analysis |
| POST /code | `{language,mode,request,originalCode?}` -> code/diff, explanation, sources and parser status |

Requests are bounded to 24 KiB at the HTTP layer and smaller per-field limits.
Persistent limits allow ten costly requests/minute per user, 100/org/hour and two
concurrent requests/user. An overall workflow deadline bounds provider retries. Missing/failed AI services return understandable unavailable results;
original scan results remain available. Stale/corrupt indexes require operator
repair; an empty index produces an explicit insufficient-context result.

## Privacy, reliability and limits

Hosted AI is disabled by default for new organizations; existing organizations
retain the hosted-AI behavior they had before this setting was added. Owners or
admins can turn it off or on, and each member reviews a sanitized evidence preview and derived
retrieval query before approving a request. The preview includes supplied event
or finding fields and complete code-review input; it identifies the approved
shared security corpus used for retrieval. NVIDIA receives the retrieval query,
selected corpus excerpts and sanitized evidence for hosted inference. Redaction
handles representative credential, email and sensitive-field patterns, but
cannot guarantee removal of every secret or private fact. Private organization
files are not indexed by this MVP. Trial terms may restrict confidential
submissions and allow content use/monitoring; see the official references linked
in [NVIDIA_PROVIDER.md](docs/NVIDIA_PROVIDER.md). See the complete
[hosted AI data-control details](docs/AI_DATA_CONTROLS.md).

Retrieved text, logs and code are untrusted data under a separate system policy.
Schema/citation checks reject malformed or unsupported outputs, but cannot prove
all statements are true or defeat every prompt injection. Model severity is
advisory; risk scores are not probabilities. Synthetic events do not establish
network detection accuracy. Source-ID validity is not semantic citation proof.

JavaScript/TypeScript are parsed in a bounded worker; Python uses a trusted
isolated AST parser with stdin, size and time limits. Generated programs/tests
are never evaluated. C/C++/Bash syntax and unified-diff validation are unavailable
and labeled as such. No dependency is installed from a generated suggestion.
No host blocking, firewall change, automatic patch application or merge occurs.
An explicit owner/admin review action can create a new proposal branch and draft
PR, after exact-source and available syntax checks. Project tests remain unexecuted.

## Attribution and submission evidence

Package manifests declare ISC; no original root LICENSE was supplied, so verify
ownership/license text before redistribution. npm dependencies retain their own
licenses. NVIDIA model cards link OpenMDW-1.1 and API Trial Terms; no weights are
distributed here. Semgrep/Bandit and downloaded scanner rules retain their own
terms. All new guidance and fixtures are original project demonstration material;
no third-party traffic or security corpus was imported.

See [repository audit and phase record](docs/NVIDIA_HACKATHON_PLAN.md),
[changed-file inventory](docs/CHANGES.md), and [technical submission summary](docs/SUBMISSION.md).
The specific hackathon was not identified; eligibility, permitted usage and
submission-rule compliance remain unverified. No detection-accuracy improvement
or submission readiness is claimed beyond the recorded evidence.

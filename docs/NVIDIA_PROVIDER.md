# Optional hosted NVIDIA provider (Phase 2)

This shared backend service powers the integrated RAG and assistant workflows.
The implementation does not download a model or require local GPU/CUDA.
The existing scanner, worker, finding schema and risk formula are unchanged.

## Setup and diagnostics

Use Node 22.23.1 or compatible newer Node with native fetch/Response/ReadableStream.
From `backend`, install dependencies with the verified clean-install command.
The baseline lockfile defect has been repaired while adding the syntax parser:

```powershell
npm ci --ignore-scripts --no-audit --no-fund
```

Copy `backend/.env.example` to `backend/.env` locally if no .env already exists.
Set NVIDIA_API_KEY there. It is ignored by backend and root ignore rules.
Do not paste the key into chat, frontend source, browser storage or a VITE_ variable.
The diagnostic loads `.env` relative to the current directory; run it from backend.
It does not import MongoDB, Redis, GitHub, or Passport configuration.

```powershell
cd backend
npm run nvidia:health
npm run test:nvidia
# Explicit hosted integration test: two tiny synthetic requests, consumes API quota.
npm run nvidia:health -- --live
```

Configuration-only diagnostics send no network request. `reachable: null` means
untested, not an outage or success. Missing/invalid settings return a diagnostic
and exit 1. The live probe requires READY from chat and a valid embedding vector;
it returns request IDs/dimensions, never the key. Both chat and embeddings have
been verified live in this workspace. See EVALUATION.md for broader live results.

The existing `GET /api/v1/health` includes optional `data.ai` configuration status
while retaining `data.status: ok`. Missing NVIDIA settings cannot make that
handler fail. Other existing application startup requirements still apply:
DATABASE_URL, Google OAuth, GitHub App private key and Redis/scanner services in
normal mode. Explicit `npm run demo` uses the same server without those services.

## Configuration

See `.env.example` for all variables. Defaults:

| Variable | Default |
| --- | --- |
| NVIDIA_BASE_URL | https://integrate.api.nvidia.com/v1 |
| NVIDIA_CHAT_MODEL | nvidia/nemotron-3.5-lightning-30b-a3b |
| NVIDIA_EMBEDDING_MODEL | nvidia/nemotron-3-embed-1b |
| NVIDIA_EMBEDDING_DIMENSIONS | 2048 |
| NVIDIA_CONNECTION_TIMEOUT_MS | 30000 |
| NVIDIA_RESPONSE_TIMEOUT_MS | 60000 |
| NVIDIA_MAX_RETRIES | 2 (three attempts total) |
| NVIDIA_MAX_TOKENS | 2048 |

Connection timeout covers DNS/TLS/request through response headers; response
timeout covers body streaming. Transient failures and 429 retry after bounded
250/500 ms backoff by default. Authentication, invalid requests and malformed
responses do not retry. Redirects are rejected to avoid forwarding credentials.
Base URL must use HTTPS without URL credentials/query/fragment. Only an operator
should configure an alternate endpoint; no browser URL is accepted.

Chat uses nonstreaming text, temperature 0.2, top_p 0.95 and disabled thinking.
These are initial application settings, not measured optimal sampling. Responses
must finish with `stop`; truncated, filtered and empty answers are rejected.
Embedding batches have at most 16 texts, each at most 3000 UTF-8 bytes, and must
specify `passage` for indexing or `query` for retrieval. Returned indices must
cover the batch exactly, with finite nonzero vectors of the configured dimension.
Changing model requires explicitly configuring its documented dimensions and,
rebuilding the RAG index. No silent model substitution.

No raw prompts, response bodies, keys or transport errors are logged. Request
IDs, operation, attempt, status and elapsed time are available through the
injected logger. Transport is injectable for deterministic offline tests.
Input validation and a 4 MiB streamed response cap bound resource use.

## References and data handling

Verified 2026-10-19 against official sources:

- [Chat API example](https://build.nvidia.com/nvidia/nemotron-3.5-lightning-30b-a3b)
  supplies the endpoint, model and chat-template argument. Nonstreaming and
  disabled thinking were verified live. The [model inference reference](https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3-5-lightning-30b-a3b-infer)
  documents chat parameters but does not list response_format or JSON schema;
  this integration therefore parses and validates JSON rather than assume
  provider-enforced structured output. It does not poll asynchronous HTTP 202
  jobs; non-completion responses fail validation safely.
- [Embedding inference](https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3-embed-1b-infer)
  specifies modes and float encoding. Its endpoint input limit says 4096 tokens,
  while the model card says 32768 context. This provider uses conservative short
  excerpts and no truncation, rather than depend on the larger limit.
- [Embedding model card](https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3-embed-1b)
  documents 2048 dimensions. Both model cards link OpenMDW-1.1 licensing;
  dependencies retain their own licenses.
- [NVIDIA API Trial Terms](https://assets.ngc.nvidia.com/products/api-catalog/legal/NVIDIA%20API%20Trial%20Terms%20of%20Service.pdf)
  are linked by the model cards. Review sections 1.2, 2.4, 2.6(a), and 3.3 before
  using real content. The trial is for testing/evaluation; it restricts sensitive
  or confidential submissions and permits content processing for service
  improvement and security monitoring. No zero-retention assurance is made here.

The health CLI sends synthetic diagnostic text. Indexing sends sanitized approved
passages; assistant/evaluation commands send minimized context and inputs.
General provider calls transmit their arguments to the configured host. The
ingestion/assistant services apply best-effort redaction; the low-level provider
cannot establish whether arbitrary caller text is safe to transmit.
No generated content is executed or applied. No hackathon eligibility, model
quality, production readiness, or detector accuracy improvement is claimed.

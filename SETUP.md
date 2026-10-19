# SecurePatch - Security Scanning Pipeline Setup & Architecture Guide

Optional hosted NVIDIA integration: see [provider setup and diagnostics](docs/NVIDIA_PROVIDER.md)
and the [repository audit and phased implementation status](docs/NVIDIA_HACKATHON_PLAN.md).
The hosted provider, persistent RAG and assistant UI/API are implemented and have
live verification. Start the synthetic demo with `npm run demo` in backend;
see [the repeatable demo](docs/DEMO.md) and [current README](README.md) for setup,
tests, evaluation and the explicit limits of the original scan environment.

## Sign-in and first workspace

Configure Google OAuth and the existing GitHub App's **Client ID** and **Client
secret** in the backend environment. GitHub's App ID/private key authenticate
repository operations; they do not replace the OAuth client credentials.

For production, register these exact callback URLs with their providers:

- Google: `https://avpr-psi.vercel.app/api/v1/auth/google/callback`
- GitHub: `https://avpr-psi.vercel.app/api/v1/auth/github/callback`

Set `GITHUB_CALLBACK_URL` to the GitHub callback in Vercel, and use
`http://localhost:5000/api/v1/auth/github/callback` for local development.
The GitHub App requires read access to **Email addresses** to identify a verified
email. Repository **Contents** and **Metadata** remain read-only. Sign-in uses
one-use session state and PKCE. Only verified email addresses can link existing
accounts; signed-in users can also explicitly link their GitHub identity.

After signing in, create an organization in the workspace selector. On the GitHub
page, authorize GitHub and connect a permitted installation. The installation
list contains personal installations owned by that GitHub user and organization
installations for which GitHub confirms administrator membership. Installation
authorization expires after one hour; sign in with GitHub again to refresh it.
OAuth access tokens are used during the callback and are not persisted.

The production assistant uses the approved shared corpus bundled at
`backend/knowledge/index.json`. After changing an allowlisted source, run
`npm run rag:bundle` in `backend` and commit the refreshed index. This indexes
only the explicit files in `backend/knowledge/sources.json`; it includes no
repository uploads or user data. Fresh Vercel instances use this read-only
artifact when no local index exists. Embedding settings must match the index.

## Overview

SecurePatch features an asynchronous, orchestrated security scan pipeline powered by:
- **GitHub App Installation-Scoped Authentication**: Ephemerally downloads authorized repository zipballs via Octokit (no `git clone`, no permanent source code stored in MongoDB).
- **Ephemeral Workspace Execution**: Extracts code to a temporary directory (`os.tmpdir()`), runs scanners, and cleans up completely in a `finally` block.
- **Scanner Orchestration Layer**: Pluggable adapters (`SemgrepAdapter`, `BanditAdapter`) executed independently of web request controllers.
- **Normalizer & Deduplicator**: Normalizes findings to a unified schema and generates deterministic SHA-256 fingerprints to eliminate duplicate reports.
- **Auditable Weighted Risk Model**:
  $$\text{Risk} = 0.40 \times \text{Severity} + 0.25 \times \text{Exploitability} + 0.15 \times \text{Occurrence} + 0.20 \times \text{Business Impact}$$
- **BullMQ / Redis Asynchronous Processing**: HTTP requests enqueue scan jobs and immediately return `202 Accepted`. Background worker processes jobs separately.

---

## Original Scanning Services and Processes

The original scan environment requires MongoDB (DATABASE_URL), configured
Google OAuth/GitHub App credentials, Redis, the API, the worker, and the frontend.
Semgrep and/or Bandit must be installed on the worker PATH. MongoDB and original
external integrations were not configured in this workspace during verification.
The API/worker/Redis commands below describe the existing scan workflow.

### Process 1: Redis Server
Redis is required for the BullMQ queue (`securepatch-scan-queue`).
```bash
# Via Docker
docker run -d --name securepatch-redis -p 6379:6379 redis:alpine

# Or verify local Redis
redis-cli ping
# Expected: PONG
```

### Process 2: Backend Express API Server
Handles authentication, sessions, organizations, RBAC, GitHub App connection, and scan enqueueing:
```bash
cd backend
npm run dev
# Server listening on http://localhost:5000
```

### Process 3: Standalone BullMQ Scan Worker
Consumes queued scan jobs, extracts ephemeral workspaces, runs security analyzers, and persists risk-scored findings:
```bash
cd backend
npm run worker
# [ScanWorker] Ready and listening for jobs on queue 'securepatch-scan-queue'...
```

---

## Development & Test Commands

### Running Pipeline Unit & Model Tests
```bash
cd backend
npx jest tests/scan.test.js tests/models.test.js
```

### Running Frontend
```bash
cd frontend
npm run dev
# Runs on http://localhost:5174
```

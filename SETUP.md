# SecurePatch - Security Scanning Pipeline Setup & Architecture Guide

Optional hosted NVIDIA integration: see [provider setup and diagnostics](docs/NVIDIA_PROVIDER.md)
and the [repository audit and phased implementation status](docs/NVIDIA_HACKATHON_PLAN.md).
The hosted provider, persistent RAG and assistant UI/API are implemented and have
live verification. Start the synthetic demo with `npm run demo` in backend;
see [the repeatable demo](docs/DEMO.md) and [current README](README.md) for setup,
tests, evaluation and the explicit limits of the original scan environment.

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

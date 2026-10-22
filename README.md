# AVPR-Net

A repository security platform for scanning code, reviewing vulnerabilities, and evaluating suggested fixes.

[Visit AVPR-Net](https://avpr-psi.vercel.app/)

## Features

- Sign in with GitHub or Google and manage team workspaces.
- Connect selected repositories through the GitHub App.
- Scan JavaScript, TypeScript, and Python using Semgrep, Bandit, and credential-pattern checks.
- Optionally check npm dependencies for known vulnerabilities.
- Review findings with file locations, source context, severity, and risk factors.
- Track scan history, compare compatible results, and export JSON or SARIF reports.
- Get NVIDIA-powered explanations and code suggestions with explicit approval.
- Validate proposed patches and create reviewed draft pull requests when GitHub permissions are configured.
- Manage team invitations, roles, and in-app scan notifications.
- Switch between light and dark themes.

## Tech stack

- **Frontend:** React, Vite, Tailwind CSS
- **Backend:** Node.js, Express, Passport
- **Database:** MongoDB
- **Scanning:** Semgrep, Bandit, credential checks, OSV
- **AI:** NVIDIA-hosted inference and embeddings
- **Deployment:** Vercel services, Queues, and scanner worker

## Getting started

### Prerequisites

- Node.js 22.23.1 and npm
- MongoDB Atlas or a replica set supporting transactions
- Google OAuth and GitHub App credentials
- Semgrep and Bandit installed for full scanner coverage
- An NVIDIA API key for AI features

### Backend

From the repository root:

```powershell
cd backend
npm ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Fill in the database, session, OAuth, GitHub App, and optional NVIDIA settings in `backend/.env`, then start the API:

```powershell
npm run dev
```

Keep secrets in the backend environment and out of frontend `VITE_` variables.

### Frontend

In a second terminal, from the repository root:

```powershell
cd frontend
npm ci
npm run dev
```

Open [localhost:5174](http://localhost:5174).

Use these local OAuth callback URLs:

```text
Google: http://localhost:5000/api/v1/auth/google/callback
GitHub: http://localhost:5000/api/v1/auth/github/callback
```

Redis is optional locally. If you configure `REDIS_URL`, also start `npm run worker` from the backend directory.

## Usage

1. Sign in and create or select a workspace.
2. Connect a GitHub App installation and authorize repositories.
3. Open a repository and start a scan.
4. Review the findings, source locations, and scanner coverage.
5. Review suggested changes before creating a draft pull request.

AI suggestions are advisory. AVPR-Net does not execute project code, run project tests, merge pull requests, or automatically change the default branch.

## Development

Run backend tests:

```powershell
cd backend
npm test
```

Run frontend tests or create a production build:

```powershell
cd frontend
npm test
npm run build
```

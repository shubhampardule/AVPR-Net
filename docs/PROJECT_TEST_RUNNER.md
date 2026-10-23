# Hosted project-test execution

The `npm-ci-tests-v1` profile connects approved finding proposals to fresh GitHub-hosted
Linux VMs. It is deliberately limited to npm projects with a root package or
backend/frontend packages (at most two), `npm test`, and npm lockfile v2/v3.
Workspaces, local/git/non-registry dependencies, dependencies without integrity
hashes, installation scripts, Python environments and arbitrary custom commands
are not supported. Unsupported or unavailable runs never count as passes.

## Flow and access boundaries

1. A member approves execution after an exact-patch static rescan passes. The API
   validates source and hashes again, applies organization/global budgets and
   stores a bounded, expiring job. The patch is transient, never a workflow input.
2. A GitHub App installation dispatches an event to the operator's AVPR-Net repo.
   The payload contains only a job identifier. No permanent GitHub Actions token
   or application credential is added to the workflow.
3. The supervisor authenticates using GitHub OIDC. The API verifies the RS256
   signature using GitHub's fixed JWKS endpoint, issuer, audience, immutable repo
   and owner IDs, main ref, workflow path, hosted-runner claim, token times and
   the exact operator-approved supervisor SHA. Tokens from pull requests, forks,
   other workflows/revisions and self-hosted runners are refused.
4. The server issues a single-run lease and a short-lived GitHub archive URL for
   the exact scanned commit. The supervisor validates bounded archive entries,
   target source/patch/proposed hashes and exact single-file patch applicability.
5. Dependency preparation runs `npm ci --ignore-scripts --no-audit --no-fund` in
   a restricted container with network access and only package metadata mounted.
   Only HTTPS npm-registry archives with integrity hashes are allowed. The package
   installer does not receive the repository source, host tokens or platform secrets.
6. Baseline and proposed `npm test` commands run in separate nonroot containers
   without network, application credentials, host sockets or writable source/deps.
   The root is read-only, with bounded temporary storage, CPU, memory, PIDs,
   output and a two-minute limit per command. Raw output is discarded, not logged.
   Install containers use the nonroot supervisor UID so temporary files can be
   removed; test containers use UID 65532. A pinned official Node image is used.
7. Heartbeats recheck membership, organization state, deadline and the owning
   lease. Cancellation stops execution; late/replayed/other-run results cannot
   publish success. Container removal and temporary workspace cleanup are required.
8. The API accepts only a bounded result matching all input hashes. A pass requires
   passing baseline and proposed commands for every selected package. A draft PR
   can carry this proof and retains its profile, runner SHA and GitHub run link.
   Static-only draft PRs remain explicitly labeled with tests not executed.

`npm test` is the customer's test script. An exit-zero script does not establish
test coverage, semantic equivalence, or freedom from vulnerabilities. Tests needing
network services, install hooks, writable source, unsupported runtimes or additional
system packages can fail or be unavailable. This is not an independent security
assessment of Docker or GitHub, and no universal sandbox guarantee is claimed.

## Operator configuration and rollout

Set `PROJECT_TEST_RUNNER_SHA` to the exact reviewed commit containing
`.github/workflows/project-tests.yml` and its supervisor. The dispatcher repo is
`shubhampardule/AVPR-Net`, installation 173100925. The pin must be updated deliberately
when the supervisor/main revision changes. A missing pin disables dispatch. Do not
copy a moving branch name into this variable or loosen the OIDC revision checks.

Before enabling the production pin, the CI contracts must pass for the exact
revision. They cover the nonroot, read-only, networkless, credential-free test
boundary, resource controls, timeout/output teardown, npm test execution with
installation scripts disabled, a passing proposal, and a failing proposal.
Production acceptance additionally requires a real job claim/result round trip.

Jobs expire after 24 hours (MongoDB TTL cleanup is asynchronous). Request deadlines
are 20 minutes; failed, cancelled, expired or completed jobs erase the transient
patch and lease. Each org can request three jobs per hour and the service twenty
per day. No customer source or raw test logs are uploaded as Actions artifacts.

References: [GitHub OIDC claims](https://docs.github.com/en/actions/reference/security/oidc),
[repository dispatch permissions](https://docs.github.com/en/rest/repos/repos#create-a-repository-dispatch-event),
[Docker runtime controls](https://docs.docker.com/reference/cli/docker/container/run/).

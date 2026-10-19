# Technical submission summary

SecurePatch helps developers and security reviewers investigate repository
vulnerabilities and draft defensive fixes. The supplied AVPR-Net folder contains
a working static-analysis architecture, not a trained network model.

The baseline React/Express application queues authorized GitHub repository scans
through BullMQ/Redis, runs Semgrep/Bandit, normalizes/deduplicates findings and
stores deterministic risk-prioritized results in MongoDB. That pipeline and its
risk calculation remain intact and are covered by regression tests.

The extension uses NVIDIA-hosted Nemotron 3.5 Lightning 30B A3B for advisory
analysis and defensive code proposals, and Nemotron 3 Embed 1B for passage/query
embeddings. A small persistent local exact-cosine index stores explicitly
approved guidance/project excerpts with hashes, source types and line references.
Section-aware chunking, incremental updates and safe rebuilds make it repeatable.

Completed features: shared hosted provider with bounded failures; persistent
RAG and source inspection; synthetic/manual event and actual-finding adapters;
source-resolved advisory analysis; Python/JavaScript/TypeScript/C/C++/Bash code
generation and diff review; nonexecuting syntax checks where supported;
authenticated organization-scoped API routes; existing-app assistant UI and
loopback-only synthetic demo mode; regression/security tests, evaluation and demo
documentation. No response action, generated program, patch or test is executed.

Validation: 150 offline tests pass across 11 suites, including formerly
configuration-blocked baseline tests after test-only mocks. Clean backend and
frontend installs, isolated tests, and frontend build pass. Both main workflows
were verified through the browser with live NVIDIA requests.

Two nine-workflow live runs each completed 7/9 structured responses. Retrieval
expected-document hit@3 was 4/5 initially and 5/5 after section-aware chunking.
Revised live median latency was 11.324 seconds; maximum 40.485 seconds. All
completed responses used valid supplied source IDs, which does not establish
semantic citation accuracy. See EVALUATION.md and the machine-readable reports.

Limits: live schema/citation failures remain; only JS/TS/Python source receives
syntax checks; no generated-code behavioral tests ran; no production network
detector or attack-accuracy result exists. The original authenticated scan path
needs MongoDB/Redis, OAuth/GitHub credentials and scanners and was not verified
end to end here. Privacy minimization is best effort and trial terms constrain
content use. Production sessions/deployment require further review.

Next steps: improve measured schema reliability, independently review semantic
citations and generated tests, add safe language parsers/isolation if needed,
verify the original authenticated scanning deployment, and evaluate a larger
authorized dataset. The specific NVIDIA hackathon and its rules were not
provided, so eligibility, permitted usage and submission compliance are not
claimed. Verify the actual event rules and original licensing before submission.

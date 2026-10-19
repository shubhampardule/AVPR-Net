# Reproducible evaluation record

Measured 2026-10-19 on Windows x64, Node v22.23.1, npm 10.9.8. All fixtures and
guidance are original synthetic project material. No production traffic, labeled
network-detection dataset or external security-rule corpus was used.

## Baseline and regression tests

Before changes: 17 tests passed in three suites; auth/health suites failed to
load because service configuration was absent. The documented scanner/model
subset passed 15 tests. The frontend built. Backend clean install failed due to
missing lockfile entries; actual server startup and scanners were unavailable.

After changes: **150 tests across 11 suites pass**, including the five original
auth/health tests after adding test-only settings and GitHub/queue mocks.
Production startup requirements were not relaxed. Clean isolated backend
installation and copied-source tests also pass 150/150; clean frontend installation
and production build pass. Installation used `npm ci --ignore-scripts --no-audit
--no-fund`. Vite still reports the existing >500 kB bundle-size warning.

Tests exercise actual normalization/risk logic, injected provider failures and
retries, bounded/redacted inputs, valid/invalid responses, citations, persistent
RAG reload/update/rebuild, source bounds, parser nonexecution, tenant lookup,
authentication/membership, demo origin/header restrictions, JSON size/errors,
safe logging, rate and concurrency guards. They do not prove live GitHub scans
or generated-code behavioral correctness.

## Live measurements

Models: `nvidia/nemotron-3.5-lightning-30b-a3b` and
`nvidia/nemotron-3-embed-1b` (2048 dimensions), NVIDIA hosted v1 endpoint.
Chat uses temperature 0.2, top_p 0.95, max_tokens 2048, thinking disabled;
header deadline 30 seconds, body deadline 60 seconds, at most two retries.

Five retrieval cases each name one expected document. A hit means a chunk from
that file appears among up to three results above the configured similarity
threshold. Nine workflow cases comprise two synthetic events, six code languages
and one JavaScript diff review. Every failure stays in the denominator.

| Measurement | Initial v1 run | Revised v2 run |
| --- | --- | --- |
| Approved corpus | 8 chunks / 4 files | 29 section-aware chunks / 4 files |
| Expected-document hit@3 | 4/5 | 5/5 |
| Valid structured workflows | 7/9 | 7/9 |
| Source-ID validity among completed responses | 7/7 responses, 8 IDs | 7/7 responses, 10 IDs |
| Syntax checks passed / performed | 3/3 | 2/2 |
| Completed proposals with parser unavailable | 2 | 3 |
| Generated tests executed | 0 | 0 |
| Logical workflow error rate | 2/9 (22.2%) | 2/9 (22.2%) |
| Failed provider attempts / all attempts | 3/26 | 1/24 |
| Median / max end-to-end workflow latency | 19.014 / 56.820 seconds | 11.324 / 40.485 seconds |

Initial run: 15:28:55–15:32:48 UTC (20:58:55–21:02:48 IST).
Revised run: timestamps and corpus hash are recorded in the reports below.
Do not interpret this small, uncontrolled before/after observation as a proven
model-quality or latency improvement.

The first run missed C/C++ buffer guidance and rejected C/C++ metadata strings
where arrays were expected. A diagnostic showed valid text encoded as single
items. V2 split Markdown sections, added bounded known-field normalization,
and allowed approved project sources in code retrieval. V2 retrieved the C/C++
guide and completed the C proposal, but Python and C++ responses failed schema/
citation validation. They remain unavailable results; no code is applied.
Live output variability remains a material reliability limitation.

Machine-readable evidence, containing metadata only and no API credentials:

- [Initial live report](evaluation/live-v1.json)
- [Revised live report](evaluation/live-v2.json)

Full synthetic input/result artifacts are local ignored files under
`backend/.local/`. Subsequent evaluations archive timestamped reports and
artifacts as well as updating the latest report. The initial v1 report/artifacts
were explicitly retained before the second run. Later documentation changes
to SETUP.md are picked up on indexing; use the recorded corpus hash to identify
which source snapshot a measurement used.

## Reproduce

From backend:

```powershell
npm test
npm run evaluate
# Requires key/network; uses quota and retains errors in its report.
npm run evaluate -- --live
```

The offline evaluator rebuilds its own artificial-vector index, never the live
index, and returns deterministic canned responses. It verifies orchestration,
not NVIDIA quality. The live evaluator incrementally indexes approved sources;
after changing model/chunker settings first use `npm run rag:index -- --rebuild`.
Both evaluators save environment, settings, source names, corpus hash, outcomes,
latency and error counts. A nonzero live exit means a workflow failed.

## Interpretation limits

- Source-ID membership verifies that a citation was supplied, not that the
  document proves every generated statement. No semantic citation-precision
  benchmark was performed.
- Parser success only establishes syntax under that parser. No generated program
  or generated test was executed; generated-code unit-test pass rate is **not
  measured**. Suggested tests can contain errors.
- C/C++/Bash and unified diffs have no safe parser in this MVP. Unavailable
  validation is excluded from the "checks performed" denominator and shown
  separately; it is never counted as passed.
- Event fixtures have scenario intent, not production ground truth. Detector
  precision/recall, attack accuracy and any detection improvement are **not
  measured**. The original full authenticated scanner was not exercised here.
- Sample size is five queries and nine workflows per live run. Hosted conditions,
  generation, timeouts and latency vary; these are demonstration measurements.

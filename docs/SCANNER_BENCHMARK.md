# Offline scanner and correlation evaluation

Status: evaluation tooling implemented locally. An independently reviewed real-project dataset and measured production detection rates are **not** supplied. R03/R04 remain open until those evaluations are performed.

From `backend`, run `npm run benchmark -- path/to/annotations.json`. It reads at most a 5 MiB JSON file and evaluates at most 10,000 metadata records across 1,000 cases. It does not fetch repositories, execute code, call scanners/providers, or upload annotations. Do not commit private source paths or datasets without the repository owner's authorization.

Example synthetic input:

```json
{
  "schemaVersion": 1,
  "datasetKind": "synthetic",
  "cases": [{
    "id": "paired-sample-v1",
    "language": "javascript",
    "coverageComplete": true,
    "expected": [{ "scanner": "semgrep", "ruleId": "example-rule", "filePath": "sample.js", "line": 3 }],
    "observed": [{ "scanner": "semgrep", "ruleId": "example-rule", "filePath": "sample.js", "line": 3 }],
    "correlation": [{ "id": "finding-1", "expectedIssue": "reviewed-issue-1", "actualGroup": "predicted-group-1" }]
  }]
}
```

For `datasetKind: "reviewed"`, provide top-level `review: { "reviewer": "...", "method": "...", "date": "YYYY-MM-DD" }`. These are attributed claims from the dataset author, not verification of reviewer independence. Use pinned repository revisions, scanner versions/rules and normalization policy in your separately retained dataset manifest; have reviewers annotate unsafe **and** safe samples without looking at scanner predictions. Record disputed labels explicitly before producing the input. Do not select samples solely because the scanner already found them.

Only fully covered cases are accepted. Export normalized observations at the same scanner/rule/path/line granularity as the annotation. Exact one-to-one matching yields true positives, false positives and false negatives by language, scanner and rule. Repeated observations are counted as false positives after the first match. Undefined precision/recall denominators return null, not 100%. No true-negative count or overall “accuracy” is invented. Exact line matching can count relocated or differently anchored findings as misses; review that limitation when designing annotations.

Optional correlation rows pair the same finding ID with the reviewed issue identity and the implementation's predicted group. Wrongly grouped distinct issues count as false-merge pairs; separated findings for the same issue count as false-split pairs. Pair counts are computed within each case, not across unrelated repositories. A duplicate exact scanner/rule/path/line observation is separately counted as a duplicate detection. Distinct scanner evidence should remain separate unless a reviewed policy justifies grouping it.

Synthetic test output demonstrates arithmetic and schema handling only. It must not be presented as AVPR-Net's real-world detection performance.

## Public-advisory pilot — 23 October 2026

An initial **project-authored, non-independent** pilot now runs the actual Semgrep
and Bandit adapters against selected upstream files before and after two published
security fixes. This is separate from the reviewed benchmark above: it does not
compute precision/recall or establish production detection performance.

From `backend`, run:

```text
npm run benchmark:advisories -- --download-public-sources
```

The flag explicitly enables downloads from `raw.githubusercontent.com`. The
checked-in `backend/fixtures/advisory-pilot.json` pins full commit IDs, six file
hashes, advisory references, and eight target call sites. Files are downloaded
with redirects forbidden, a 15-second per-request deadline and a 1 MiB limit;
hash mismatches fail closed. No upstream package installation, repository code,
proof of concept, or upstream tests are executed. Only static scanner binaries
already installed locally run, with the application's restricted scanner
environment. Both host and WSL source workspaces are removed afterward; cleanup
failure prevents a success report. Upstream source is not vendored in this repo.

The manifest uses the parent and fix commits of
[Suricata Update's unsafe YAML fix](https://github.com/OISF/suricata-update/commit/76270e73128ca1299b4e33e7e2a74ac3d963a97a)
and [Argos's shell command injection fix](https://github.com/argos-ci/argos-javascript/commit/8355f3af3be3f4fe361d58a688d21535cf672717).
Annotations follow those published diffs; they are not blinded or independently
reviewed. Only three selected files per revision are scanned, not entire projects.

Observed with Semgrep **1.181.0** and Bandit **1.9.4**:

| Selected target | Scanner | Before: target sites with alerts | After: target sites with alerts | Other alerts before / after |
| --- | --- | --- | --- | --- |
| Four unsafe YAML loads | Semgrep | 4 / 4 | 0 / 4 | 0 / 0 |
| Four unsafe YAML loads | Bandit B506 | 4 / 4 | 0 / 4 | 0 / 0 |
| Four shell-interpolating calls | Semgrep | 4 / 4 | 0 / 4 | 4 / 4 |

Every scanner's covered file set is verified against the selected source set,
including its path digest. Semgrep covers all three files and Bandit both Python
files on each revision. Alert matching uses scanner, rule, file and line span.
The four remaining shell alerts point to unchanged calls and remain unadjudicated;
they are **not** automatically false positives. Absence of a target alert does not
mean the patched project is secure. The two Python scanners report overlapping
sites; this run does not measure application correlation or review carry-forward.
The [retained metadata report](evidence/advisory-pilot-2026-10-23.json) contains no
source code, credentials, or temporary host paths.

R03/R04 remain open. Next evaluation work requires independent safe/unsafe labels,
more projects and languages, disputed-label handling, and end-to-end identity
evaluation. The pilot normalizes Semgrep's machine-specific rule prefix only for
its report; it does not migrate existing product finding identities or reviews.

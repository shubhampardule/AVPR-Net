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

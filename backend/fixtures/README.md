# Fixture provenance and expectations

All fixtures in this directory were authored for this project on 2026-10-19.
They are synthetic and contain no captured traffic, private source or production
identifiers. No external dataset or third-party rule corpus was imported.

Events: `suspicious.json` describes 120 failed SSH authentications in 60 seconds;
expected behavior is retained counts, possible guessing/automation explanations,
false-positive checks, and explicit lack of confirmed compromise. `benign.json`
describes six expected HTTPS checks in one minute; expected behavior is inventory
validation and cautious interpretation. These labels express scenario intent;
they are not ground-truth labels for a network detector.

Code fixtures exercise six language configurations plus a JavaScript review.
Port parsers should reject malformed values and respect bounds; the Python
aggregation fixture should bound counts and reject malformed records. Suggested
tests are unexecuted proposals. Parser success is not functional verification.
C/C++/Bash and diffs report unavailable validation in the current implementation.

Retrieval fixtures name one expected source file per known-answer query.
`hit@3` means at least one chunk from that file appears in three filtered results;
this is document-level hit rate, not passage recall or semantic citation accuracy.
The mock evaluator uses deterministic artificial vectors and canned responses;
only `--live` measures NVIDIA retrieval and hosted workflow validity/latency.

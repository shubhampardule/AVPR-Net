# Defensive code generation and review

Provenance: original project guidance for demonstration and regression tests.
Examples and tests proposed by the model require independent human review.

## Python

For a subprocess utility, use a fixed executable and an argument list, shell=False,
a timeout and bounded captured output. Validate arguments against the intended
operation. Avoid os.system, eval and string-built shell commands. A parser can
check syntax without running the program; it cannot establish security.
Propose tests for rejected inputs and timeout/error paths.

## JavaScript and TypeScript

Use parameterized SQL values rather than interpolating user input. Validate
request shape, lengths and types; keep authorization on the server. Render text
through React escaping and avoid injecting generated HTML. Type annotations do
not validate runtime input. Use a syntax parser without running generated code.
Propose tests for malformed inputs and missing organization membership.

## C and C++

Bound input and buffer sizes, check integer conversions and return values,
and prefer managed containers or explicit lengths. Do not use gets or unchecked
strcpy. Review ownership and lifetime. Without an installed safe parser, label
syntax validation unavailable; never claim compilation or unit tests succeeded.

## Bash

Quote variable expansions, validate allowlists, avoid eval, use explicit paths,
and check command failures. Generated Bash is an unexecuted proposal. Do not
execute it or source it on the host. Without a parser, show unverified syntax.

## Remediation proposals

Prefer a reviewable unified diff when reviewing existing source. Return expected
inputs/outputs, assumptions, dependencies, security considerations and test
instructions. Never claim a patch was applied, tested, deployed or opened as a
pull request unless the application actually performed and recorded that action.
Generated tests are suggestions; their presence is not a passing test result.

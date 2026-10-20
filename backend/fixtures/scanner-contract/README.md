# Scanner baseline fixtures

These paired samples are deliberately stored with `.fixture` extensions so a
normal repository scan does not report the vulnerable test code as a product
finding. `scanner-contract.js` copies them to a temporary directory with their
language extensions, runs the pinned Semgrep and Bandit tools, then removes the
directory. The samples are never executed.

The contract expects each of the twelve original Semgrep rules to detect its
matching unsafe sample, no unexpected Semgrep finding, and no finding on either
fixed sample. Bandit must detect the `shell=True` case and report nothing on the
fixed Python file. This is synthetic regression coverage, not a representative
real-world precision or recall result.

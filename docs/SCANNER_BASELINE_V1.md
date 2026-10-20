# Scanner baseline v1

This is SecurePatch's narrow project-authored baseline, not a complete SAST or
software composition analysis product. The Semgrep rule file and Bandit version
are pinned in the worker image. Every Semgrep rule is tagged `securepatch-v1`;
the rules file hash and tool versions are recorded with each scan.

| Rule | Language | Severity | CWE | Intent and main limitation |
| --- | --- | --- | --- | --- |
| `securepatch.js.dynamic-eval` | JavaScript, TypeScript | High | CWE-95 | Finds `eval` and `new Function`; cannot determine whether input is attacker controlled. |
| `securepatch.js.shell-exec` | JavaScript, TypeScript | Medium | CWE-78 | Flags `exec` and `execSync`; does not prove command input is tainted and does not cover every process API. |
| `securepatch.js.raw-html` | JavaScript, TypeScript JSX | Medium | CWE-79 | Flags `dangerouslySetInnerHTML`; cannot know whether input was safely sanitized. |
| `securepatch.js.weak-hash` | JavaScript, TypeScript | Medium | CWE-327 | Flags MD5/SHA-1 `createHash`; intended use and compatibility requirements need human review. |
| `securepatch.js.sql-concatenation` | JavaScript, TypeScript | High | CWE-89 | Finds direct query concatenation; does not model every SQL library or taint flow. |
| `securepatch.js.disabled-tls` | JavaScript, TypeScript | High | CWE-295 | Flags disabled certificate verification; custom TLS wrappers may need separate rules. |
| `securepatch.js.jwt-unverified` | JavaScript, TypeScript | Medium | CWE-347 | Flags JWT decoding; a later independent verification step may make the use safe. |
| `securepatch.python.pickle` | Python | High | CWE-502 | Finds pickle deserialization; safe only when serialized bytes are trusted. |
| `securepatch.python.dynamic-eval` | Python | High | CWE-95 | Finds `eval`/`exec`; does not establish source trust or reachability. |
| `securepatch.python.shell` | Python | High | CWE-78 | Finds `os.system` and `shell=True`; does not analyze argument taint. |
| `securepatch.python.sql-formatting` | Python | High | CWE-89 | Finds query `%`/`+` formatting; does not cover every driver or dynamic-query pattern. |
| `securepatch.python.insecure-yaml` | Python | High | CWE-502 | Flags `yaml.load` without modeling every loader/version; use a safe loader for untrusted data. |

Semgrep `ERROR`, `WARNING`, and `INFO` map to product High, Medium, and Low.
Bandit maps tool severity to the same names; only High severity plus High
confidence maps to Critical. These are prioritization labels, not probabilities
or CVSS scores. Local credential patterns report possible matches without
retaining matched values. The optional npm lockfile advisory check sends package
names and versions to OSV only when the organization enables it; its initial
severity is an explicitly unassessed Medium.

`backend/fixtures/scanner-contract` is the repeatable synthetic regression
baseline. CI runs the pinned Semgrep and Bandit binaries in a no-network,
read-only container, checks all twelve Semgrep positive cases against paired
fixed samples, and requires Bandit to find the shell execution fixture without
flagging the safe Python fixture. These fixture counts must not be presented as
real-world precision or recall. A supported-language benchmark built from
independent projects and reviewed safe/vulnerable pairs is still needed before
making coverage claims.

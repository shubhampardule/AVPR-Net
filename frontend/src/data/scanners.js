export const SCANNER_ENGINES = [
 { name: "Semgrep", type: "Static analysis", role: "Versioned AVPR-Net JavaScript, TypeScript and Python baseline", version: "1.181.0", icon: "Code2", badgeColor: "text-[#A8C4B1]", rulesCount: "12 baseline rules" },
 { name: "Bandit", type: "Python AST", role: "Python security checks with explicit scan errors", version: "1.9.4", icon: "ShieldAlert", badgeColor: "text-amber-300", rulesCount: "Installed Bandit checks" },
 { name: "Credential patterns", type: "Local pattern checks", role: "Possible token/key patterns, with values omitted from evidence", version: "v1", icon: "KeyRound", badgeColor: "text-blue-300", rulesCount: "4 patterns; unverified matches" },
 { name: "OSV (optional)", type: "Dependency advisories", role: "Opt-in npm lockfile package/version advisory matching", version: "API", icon: "Radio", badgeColor: "text-purple-300", rulesCount: "npm lockfile v2/v3" },
];
export const ENTERPRISE_CAPABILITIES = [
 { title: "Scanner coverage", description: "See tool versions, skipped files, rule sets and failures alongside each scan.", icon: "Cpu" },
 { title: "Finding provenance", description: "Keep source paths and scanner identity with a result. Compare scans only when coverage matches.", icon: "GitMerge" },
 { title: "Explainable risk", description: "Review severity, CWE, occurrence and file context. The project score is not CVSS or a probability.", icon: "BarChart3" },
 { title: "Proposed changes", description: "Inspect an exact-source diff and applicability checks before explicitly creating a draft PR.", icon: "FileCode2" },
 { title: "Repository access", description: "Access follows your GitHub App installation and organization roles; permissions can be revoked.", icon: "Github" },
 { title: "Optional automation", description: "Schedule weekly or monthly scans, or configure signed GitHub event scans.", icon: "Clock" },
];

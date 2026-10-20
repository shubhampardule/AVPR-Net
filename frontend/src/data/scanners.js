export const SCANNER_ENGINES = [
 { name: "Semgrep", type: "Static analysis", role: "Versioned SecurePatch JavaScript, TypeScript and Python baseline", version: "1.181.0", icon: "Code2", badgeColor: "text-green-300", rulesCount: "12 baseline rules" },
 { name: "Bandit", type: "Python AST", role: "Python security checks with explicit scan errors", version: "1.9.4", icon: "ShieldAlert", badgeColor: "text-amber-300", rulesCount: "Installed Bandit checks" },
 { name: "Credential patterns", type: "Local pattern checks", role: "Possible token/key patterns, with values omitted from evidence", version: "v1", icon: "KeyRound", badgeColor: "text-blue-300", rulesCount: "4 patterns; unverified matches" },
 { name: "OSV (optional)", type: "Dependency advisories", role: "Opt-in npm lockfile package/version advisory matching", version: "API", icon: "Radio", badgeColor: "text-purple-300", rulesCount: "npm lockfile v2/v3" },
];
export const WORKFLOW_STAGES = [];
export const ENTERPRISE_CAPABILITIES = [
 { title: "Explicit scanner coverage", description: "Failures, skipped files, versions and the rules hash stay with each scan.", icon: "Cpu" },
 { title: "Evidence identities", description: "Preserve path case and scanner provenance; compare matching scan coverage.", icon: "GitMerge" },
 { title: "Explainable risk", description: "Weighted severity, CWE category, occurrence and file context. Not a probability or CVSS score.", icon: "BarChart3" },
 { title: "Reviewed draft PRs", description: "Check an exact-source diff, then explicitly create a draft PR with approved write permissions.", icon: "FileCode2" },
 { title: "Honest validation", description: "Patch applicability and supported syntax checks; project tests require trusted CI.", icon: "Boxes" },
 { title: "Optional schedules", description: "Weekly/monthly scans and configured signed GitHub events.", icon: "Clock" },
 { title: "GitHub installations", description: "Repository access stays scoped to your organization's connected installation.", icon: "Github" },
 { title: "Team governance", description: "Owner, admin and developer roles with revocable organization membership.", icon: "Users" },
];

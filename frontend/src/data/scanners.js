/**
 * Integrated security scanners and pipeline stages from SecurePatch PRD.
 */

export const SCANNER_ENGINES = [
  {
    name: "Semgrep",
    type: "Static Analysis (SAST)",
    role: "Deep syntax & semantic taint-tracking for JavaScript & Python code paths",
    version: "v1.78.0",
    icon: "Code2",
    badgeColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    rulesCount: "2,400+ rules",
  },
  {
    name: "Bandit",
    type: "Python Security AST",
    role: "Dedicated Python AST security analysis for unsafe subprocess, eval, and weak crypto",
    version: "v1.7.9",
    icon: "ShieldAlert",
    badgeColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    rulesCount: "48 specialized checks",
  },
  {
    name: "Trivy",
    type: "Secrets & Dependency Scanner",
    role: "Detection of embedded credentials, tokens, CVEs, and outdated vulnerable dependencies",
    version: "v0.53.0",
    icon: "KeyRound",
    badgeColor: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    rulesCount: "Global CVE & Secret DB",
  },
  {
    name: "OWASP ZAP",
    type: "Dynamic Endpoint Assessment",
    role: "Baseline web application scanning and missing HTTP security header verification",
    version: "v2.15.0",
    icon: "Radio",
    badgeColor: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    rulesCount: "Active/Passive policies",
  }
];

export const WORKFLOW_STAGES = [
  {
    step: "01",
    id: "discover",
    title: "Discover",
    headline: "See what's hiding in your code.",
    subhead: "Multi-scanner orchestration",
    description: "SecurePatch coordinates Semgrep, Bandit, Trivy, and OWASP ZAP simultaneously. Raw scanner outputs are parsed into a normalized internal finding format across AST, line coordinates, and call chains.",
    badge: "STAGE 01 · DETECTION"
  },
  {
    step: "02",
    id: "prioritize",
    title: "Prioritize",
    headline: "Not every vulnerability deserves the same urgency.",
    subhead: "Correlation & explainable risk",
    description: "The M3 engine computes persistent AST fingerprints to eliminate duplicate scanner alerts. The M4 Risk Engine assesses exploitability, input controllability, attack surface, and business criticality to compute a transparent CVSS-aligned risk score.",
    badge: "STAGE 02 · CORRELATION"
  },
  {
    step: "03",
    id: "remediate",
    title: "Remediate",
    headline: "From finding to fix.",
    subhead: "Deterministic & guided patch generation",
    description: "Rule-based transformations and contextual code generation produce minimal, targeted unified diffs. Preserves variable naming, function signatures, and application behavior without collateral changes.",
    badge: "STAGE 03 · REMEDIATION"
  },
  {
    step: "04",
    id: "verify",
    title: "Verify",
    headline: "Fix it. Verify it. Move on.",
    subhead: "Isolated Docker sandbox testing",
    description: "Before any patch touches production or triggers a PR, it is applied in an isolated Docker container. The platform validates syntax, runs test suites, rescans for the original CWE, and certifies the risk score drops to zero.",
    badge: "STAGE 04 · VERIFICATION"
  }
];

export const ENTERPRISE_CAPABILITIES = [
  {
    title: "Multi-Scanner Ingestion",
    description: "Orchestrates Semgrep, Bandit, Trivy, and OWASP ZAP into a unified finding schema with zero manual config.",
    icon: "Cpu"
  },
  {
    title: "M3 Correlation & Deduplication",
    description: "Computes AST/fingerprint matches to eliminate duplicate scanner alerts across branches and files.",
    icon: "GitMerge"
  },
  {
    title: "Explainable Risk Scoring (M4)",
    description: "Transparent risk calculation based on exploitability, attack surface exposure, and business criticality.",
    icon: "BarChart3"
  },
  {
    title: "Non-Destructive Patching",
    description: "Generates standardized Unified Diffs on isolated Git branches (`securepatch/fix-***`). Main branch stays protected.",
    icon: "FileCode2"
  },
  {
    title: "Isolated Docker Sandbox (M7)",
    description: "Executes syntax checks, unit tests, and security rescans in hardened containers with zero host execution.",
    icon: "Boxes"
  },
  {
    title: "Autonomous Server-Side Schedules",
    description: "Weekly & monthly scans execute automatically on server workers—even when developers' laptops are offline.",
    icon: "Clock"
  },
  {
    title: "GitHub App & PR Automation",
    description: "Integrates with GitHub installations to read permitted repositories and propose verified pull requests.",
    icon: "Github"
  },
  {
    title: "Role-Based Security Governance",
    description: "Multi-tenant organization isolation with strict Owner, Administrator, and Developer access control.",
    icon: "Users"
  }
];

/**
 * Real-world vulnerability scenarios aligned 1:1 with the SecurePatch PRD & MongoDB schema.
 * Covers supported categories:
 * 1. SQL Injection (CWE-89)
 * 2. Command Injection (CWE-78)
 * 3. Hardcoded Secrets (CWE-798)
 * 4. Server-Side Request Forgery (SSRF) (CWE-918)
 * 5. Path Traversal (CWE-22)
 */

export const VULNERABILITY_SCENARIOS = [
  {
    id: "VUL-NODE-089",
    category: "SQL Injection",
    cwe: "CWE-89",
    title: "Unsanitized User Input in SQL Query Construction",
    severity: "Critical",
    riskScore: 9.4,
    priority: "P1",
    language: "JavaScript (Node.js)",
    repository: "backend-api",
    filePath: "src/routes/auth.js",
    lineNumber: 124,
    scanners: [
      { name: "Semgrep", ruleId: "javascript.express.security.sql-concat", status: "Detected" },
      { name: "OWASP ZAP", ruleId: "zap-sqli-passive-40018", status: "Correlated" }
    ],
    correlationNote: "M3 engine correlated 2 scanner findings into a single unified vulnerability via AST fingerprinting.",
    exploitability: {
      score: 9.2,
      attackSurface: "Public REST Endpoint (/api/v1/auth/login)",
      inputControllability: "Direct JSON Body Parameter (username)",
      authRequired: "None (Unauthenticated)",
      complexity: "Low (Direct String Concatenation)"
    },
    businessImpact: {
      score: 9.6,
      confidentiality: "Critical (Full Database Read)",
      integrity: "High (Potential Account Takeover)",
      availability: "Medium (Query Injection DOS)",
      businessCriticality: "Tier 1 - Authentication Service"
    },
    vulnerableSnippet: `// Express.js user authentication route
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  // VULNERABLE: Direct string interpolation bypasses prepared statements
  const query = "SELECT * FROM accounts WHERE username = '" + username + "' AND active = 1";
  const result = await db.query(query);

  if (result.rows.length === 0) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  return res.json({ token: generateToken(result.rows[0]) });
});`,
    remediatedSnippet: `// Express.js user authentication route
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  // REMEDIATED: Parameterized query isolates data from execution context
  const query = "SELECT * FROM accounts WHERE username = $1 AND active = 1";
  const result = await db.query(query, [username]);

  if (result.rows.length === 0) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  return res.json({ token: generateToken(result.rows[0]) });
});`,
    unifiedDiff: `--- a/src/routes/auth.js
+++ b/src/routes/auth.js
@@ -122,5 +122,5 @@
-  // VULNERABLE: Direct string interpolation bypasses prepared statements
-  const query = "SELECT * FROM accounts WHERE username = '" + username + "' AND active = 1";
-  const result = await db.query(query);
+  // REMEDIATED: Parameterized query isolates data from execution context
+  const query = "SELECT * FROM accounts WHERE username = $1 AND active = 1";
+  const result = await db.query(query, [username]);`,
    remediationStrategy: {
      type: "Deterministic Rule Transformation",
      strategy: "Parameterized Prepared Statement",
      rationale: "Replacing string concatenation with bound SQL parameters ensures database driver escapes all user inputs, completely neutralizing arbitrary SQL command execution.",
      remediationBranch: "securepatch/fix-VUL-NODE-089"
    },
    verification: {
      overallStatus: "Passed",
      syntaxCheck: { status: "Passed", engine: "Node.js v20.14 ESLint Check" },
      testSuite: { status: "Passed", passed: 18, total: 18, coverage: "94.2%" },
      rescan: { status: "Passed", scanner: "Semgrep + ZAP", findingsCount: 0 },
      beforeRisk: 9.4,
      afterRisk: 0.0,
      stateTransition: "OPEN → PATCHED → VERIFIED"
    }
  },
  {
    id: "VUL-PY-078",
    category: "Command Injection",
    cwe: "CWE-78",
    title: "Arbitrary OS Command Execution via shell=True",
    severity: "Critical",
    riskScore: 9.8,
    priority: "P1",
    language: "Python (Flask)",
    repository: "media-worker",
    filePath: "services/transcoder.py",
    lineNumber: 67,
    scanners: [
      { name: "Bandit", ruleId: "B602:subprocess_popen_with_shell_equals_true", status: "Detected" },
      { name: "Semgrep", ruleId: "python.lang.security.audit.subprocess-shell-true", status: "Correlated" }
    ],
    correlationNote: "Bandit AST analysis correlated with Semgrep taint-tracking engine into single finding.",
    exploitability: {
      score: 9.8,
      attackSurface: "Internal Video Processing Queue",
      inputControllability: "User-Supplied Filename Header",
      authRequired: "User Session",
      complexity: "Trivial (Shell Metacharacters | ; &)"
    },
    businessImpact: {
      score: 9.8,
      confidentiality: "Critical (Host System Access)",
      integrity: "Critical (Arbitrary Binary Execution)",
      availability: "Critical (Host Compromise)",
      businessCriticality: "Tier 1 - Core Processing Worker"
    },
    vulnerableSnippet: `def convert_video_format(filename, target_codec):
    # VULNERABLE: shell=True invokes /bin/sh; filename can contain shell operators
    cmd = f"ffmpeg -i {filename} -vcodec {target_codec} output.mp4"
    subprocess.call(cmd, shell=True)`,
    remediatedSnippet: `def convert_video_format(filename, target_codec):
    # REMEDIATED: Argument list without shell invocation prevents command injection
    safe_cmd = ["ffmpeg", "-i", filename, "-vcodec", target_codec, "output.mp4"]
    subprocess.run(safe_cmd, shell=False, check=True)`,
    unifiedDiff: `--- a/services/transcoder.py
+++ b/services/transcoder.py
@@ -65,4 +65,4 @@
-    # VULNERABLE: shell=True invokes /bin/sh; filename can contain shell operators
-    cmd = f"ffmpeg -i {filename} -vcodec {target_codec} output.mp4"
-    subprocess.call(cmd, shell=True)
+    # REMEDIATED: Argument list without shell invocation prevents command injection
+    safe_cmd = ["ffmpeg", "-i", filename, "-vcodec", target_codec, "output.mp4"]
+    subprocess.run(safe_cmd, shell=False, check=True)`,
    remediationStrategy: {
      type: "Rule-Based Transformation",
      strategy: "Subprocess Argument List Isolation",
      rationale: "Passing arguments as a strict list to subprocess.run with shell=False directly invokes the target executable without an intermediate shell parser.",
      remediationBranch: "securepatch/fix-VUL-PY-078"
    },
    verification: {
      overallStatus: "Passed",
      syntaxCheck: { status: "Passed", engine: "Python 3.11 AST Compiler" },
      testSuite: { status: "Passed", passed: 24, total: 24, coverage: "91.8%" },
      rescan: { status: "Passed", scanner: "Bandit + Semgrep", findingsCount: 0 },
      beforeRisk: 9.8,
      afterRisk: 0.0,
      stateTransition: "OPEN → PATCHED → VERIFIED"
    }
  },
  {
    id: "VUL-SEC-798",
    category: "Hardcoded Secrets",
    cwe: "CWE-798",
    title: "Plaintext Cloud Provider API Key in Configuration",
    severity: "High",
    riskScore: 8.1,
    priority: "P2",
    language: "JavaScript / Node.js",
    repository: "notification-service",
    filePath: "config/mailer.js",
    lineNumber: 19,
    scanners: [
      { name: "Trivy", ruleId: "secret-aws-access-key-id", status: "Detected" },
      { name: "Semgrep", ruleId: "generic.secrets.security.detected-aws-key", status: "Correlated" }
    ],
    correlationNote: "Trivy filesystem scanner and Semgrep rule matched on identical token offset.",
    exploitability: {
      score: 8.5,
      attackSurface: "Source Repository & Build Artifacts",
      inputControllability: "Static Git History Extraction",
      authRequired: "Repo Read Access",
      complexity: "Zero (Direct Credential Copy)"
    },
    businessImpact: {
      score: 7.7,
      confidentiality: "High (Cloud Account Access)",
      integrity: "High (Resource Provisioning)",
      availability: "High (Potential Service Teardown)",
      businessCriticality: "Tier 2 - Notification Infrastructure"
    },
    vulnerableSnippet: `// Mailer transport configuration
const mailConfig = {
  service: "SES",
  region: "us-east-1",
  // VULNERABLE: Secret hardcoded in committed source file
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
};`,
    remediatedSnippet: `// Mailer transport configuration
const mailConfig = {
  service: "SES",
  region: process.env.AWS_REGION || "us-east-1",
  // REMEDIATED: Credentials loaded securely from environment runtime
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
};`,
    unifiedDiff: `--- a/config/mailer.js
+++ b/config/mailer.js
@@ -17,4 +17,4 @@
-  // VULNERABLE: Secret hardcoded in committed source file
-  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
-  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
+  // REMEDIATED: Credentials loaded securely from environment runtime
+  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
+  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY`,
    remediationStrategy: {
      type: "Deterministic Rule Transformation",
      strategy: "External Secret Environment Delegation",
      rationale: "Decouples credentials from the version-controlled codebase, delegating secret injection to runtime environment variables or container secret stores.",
      remediationBranch: "securepatch/fix-VUL-SEC-798"
    },
    verification: {
      overallStatus: "Passed",
      syntaxCheck: { status: "Passed", engine: "Node.js Syntax Linter" },
      testSuite: { status: "Passed", passed: 12, total: 12, coverage: "88.5%" },
      rescan: { status: "Passed", scanner: "Trivy Secrets Scanner", findingsCount: 0 },
      beforeRisk: 8.1,
      afterRisk: 0.0,
      stateTransition: "OPEN → PATCHED → VERIFIED"
    }
  },
  {
    id: "VUL-NET-918",
    category: "SSRF",
    cwe: "CWE-918",
    title: "Unvalidated Remote URL Fetching via Webhook Dispatcher",
    severity: "High",
    riskScore: 7.9,
    priority: "P2",
    language: "Python (FastAPI)",
    repository: "webhook-service",
    filePath: "routers/webhooks.py",
    lineNumber: 43,
    scanners: [
      { name: "Semgrep", ruleId: "python.requests.security.tainted-url-host", status: "Detected" },
      { name: "Bandit", ruleId: "B113:request_without_timeout", status: "Correlated" }
    ],
    correlationNote: "M3 engine correlated taint-tracking analysis across request wrapper.",
    exploitability: {
      score: 7.8,
      attackSurface: "Webhook Registration API",
      inputControllability: "Client-Supplied Callback URL",
      authRequired: "Authenticated User",
      complexity: "Medium (Internal Metadata Service / 169.254.169.254)"
    },
    businessImpact: {
      score: 8.0,
      confidentiality: "High (Cloud Instance Metadata Exfiltration)",
      integrity: "Medium (Internal Network Pivoting)",
      availability: "Low",
      businessCriticality: "Tier 1 - Event Webhook Pipeline"
    },
    vulnerableSnippet: `@router.post("/trigger-webhook")
async def trigger_webhook(payload: WebhookPayload):
    # VULNERABLE: Direct HTTP request to user-supplied endpoint without IP validation
    response = requests.post(payload.callback_url, json=payload.data)
    return {"status": response.status_code}`,
    remediatedSnippet: `@router.post("/trigger-webhook")
async def trigger_webhook(payload: WebhookPayload):
    # REMEDIATED: Validate URL schema, restrict to HTTPS, block private IP ranges
    validated_url = validate_public_destination_url(payload.callback_url)
    response = requests.post(validated_url, json=payload.data, timeout=5.0)
    return {"status": response.status_code}`,
    unifiedDiff: `--- a/routers/webhooks.py
+++ b/routers/webhooks.py
@@ -41,3 +41,4 @@
-    # VULNERABLE: Direct HTTP request to user-supplied endpoint without IP validation
-    response = requests.post(payload.callback_url, json=payload.data)
+    # REMEDIATED: Validate URL schema, restrict to HTTPS, block private IP ranges
+    validated_url = validate_public_destination_url(payload.callback_url)
+    response = requests.post(validated_url, json=payload.data, timeout=5.0)`,
    remediationStrategy: {
      type: "Rule-Based Transformation",
      strategy: "Destination Allowlist & Private IP Rejection",
      rationale: "Resolves hostname prior to connection and drops requests targeting RFC 1918 addresses, loopbacks, and cloud provider link-local metadata endpoints.",
      remediationBranch: "securepatch/fix-VUL-NET-918"
    },
    verification: {
      overallStatus: "Passed",
      syntaxCheck: { status: "Passed", engine: "Python Type Checker" },
      testSuite: { status: "Passed", passed: 31, total: 31, coverage: "96.0%" },
      rescan: { status: "Passed", scanner: "Semgrep + Bandit", findingsCount: 0 },
      beforeRisk: 7.9,
      afterRisk: 0.0,
      stateTransition: "OPEN → PATCHED → VERIFIED"
    }
  }
];

export const VULNERABILITY_CATEGORIES_PRD = [
  { id: 1, name: "SQL Injection", cwe: "CWE-89", severity: "Critical", count: 4 },
  { id: 2, name: "Cross-Site Scripting (XSS)", cwe: "CWE-79", severity: "High", count: 7 },
  { id: 3, name: "Command Injection", cwe: "CWE-78", severity: "Critical", count: 2 },
  { id: 4, name: "Path Traversal", cwe: "CWE-22", severity: "High", count: 3 },
  { id: 5, name: "Server-Side Request Forgery", cwe: "CWE-918", severity: "High", count: 2 },
  { id: 6, name: "Hardcoded Secrets", cwe: "CWE-798", severity: "High", count: 6 },
  { id: 7, name: "Weak Cryptography", cwe: "CWE-327", severity: "Medium", count: 5 },
  { id: 8, name: "Insecure Deserialization", cwe: "CWE-502", severity: "High", count: 1 },
  { id: 9, name: "Weak / Missing Security Headers", cwe: "CWE-693", severity: "Low", count: 9 },
  { id: 10, name: "Vulnerable Dependencies", cwe: "CWE-1395", severity: "Medium", count: 12 }
];

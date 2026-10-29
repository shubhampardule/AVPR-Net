const { validateRemediationPatch } = require("../src/utils/remediation-patch-policy");

test.each([
  ["SELECT ? FROM ?", "sqlite"],
  ["SELECT id FROM :table_name", "named"],
  ["SELECT id FROM $1", "postgres"],
  ["SELECT id FROM %(table)s", "pyformat"],
  ["SELECT id FROM %s", "format"],
])("rejects value placeholders in SQL identifier positions (%s)", query => {
  expect(() => validateRemediationPatch({ scanner: "bandit", ruleId: "B608" }, `connection.execute("${query}")`))
    .toThrow(/cannot stand for table or column names/i);
});

test("allows value placeholders while identifiers remain fixed", () => {
  expect(() => validateRemediationPatch({ scanner: "bandit", ruleId: "B608" },
    'connection.execute("SELECT * FROM users WHERE email = ?", (email,))')).not.toThrow();
});

test("does not apply the SQL guard to unrelated scanner rules", () => {
  expect(() => validateRemediationPatch({ scanner: "bandit", ruleId: "B605" }, 'run("SELECT * FROM ?")')).not.toThrow();
});

test.each([
  [{ scanner: "bandit", ruleId: "B602" }, 'subprocess.run(cmd, shell=True)'],
  [{ scanner: "bandit", ruleId: "B605" }, 'subprocess.Popen(args, shell = True)'],
  [{ scanner: "semgrep", ruleId: "securepatch.js.shell-exec" }, 'exec(cmd, { shell: true })'],
  [{ scanner: "semgrep", ruleId: "securepatch.python.shell" }, 'subprocess.call("ls", shell=True)'],
])("rejects shell=True / shell: true in command execution patches", (finding, content) => {
  expect(() => validateRemediationPatch(finding, content))
    .toThrow(/command execution must disable shell mode/i);
});

test("allows command execution without shell mode", () => {
  expect(() => validateRemediationPatch({ scanner: "bandit", ruleId: "B605" }, 'subprocess.run(["ls", "-l"], shell=False)')).not.toThrow();
  expect(() => validateRemediationPatch({ scanner: "semgrep", ruleId: "securepatch.js.shell-exec" }, 'execFile("/usr/bin/ls", ["-l"])')).not.toThrow();
});

test.each([
  [{ scanner: "bandit", ruleId: "B303" }, 'hashlib.md5(data).hexdigest()'],
  [{ scanner: "bandit", ruleId: "B324" }, 'hashlib.sha1(data).digest()'],
  [{ scanner: "semgrep", ruleId: "securepatch.js.weak-hash" }, 'crypto.createHash("md5").update(data)'],
  [{ scanner: "semgrep", ruleId: "securepatch.js.weak-hash" }, 'crypto.createHash(\'sha1\').digest("hex")'],
])("rejects weak hashing algorithms in hash remediation patches", (finding, content) => {
  expect(() => validateRemediationPatch(finding, content))
    .toThrow(/remediation must use modern collision-resistant hashes/i);
});

test("allows modern hashes in hash remediation", () => {
  expect(() => validateRemediationPatch({ scanner: "bandit", ruleId: "B303" }, 'hashlib.sha256(data).hexdigest()')).not.toThrow();
  expect(() => validateRemediationPatch({ scanner: "semgrep", ruleId: "securepatch.js.weak-hash" }, 'crypto.createHash("sha256").digest("hex")')).not.toThrow();
});

test("rejects unsafe YAML loader in YAML remediation patches", () => {
  expect(() => validateRemediationPatch({ scanner: "bandit", ruleId: "B506" }, 'yaml.load(stream, Loader=yaml.Loader)'))
    .toThrow(/YAML documents must be parsed using yaml\.safe_load/i);
  expect(() => validateRemediationPatch({ scanner: "semgrep", ruleId: "securepatch.python.insecure-yaml" }, 'yaml.unsafe_load(stream, Loader=yaml.UnsafeLoader)'))
    .toThrow(/YAML documents must be parsed using yaml\.safe_load/i);
});


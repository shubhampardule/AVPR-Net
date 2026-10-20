const fs = require("node:fs/promises");
const path = require("node:path");
const Base = require("./base.adapter");
const patterns = [
  ["github-token", /\bgh[pousr]_[A-Za-z0-9_]{25,}\b/g],
  ["nvidia-token", /\bnvapi-[A-Za-z0-9_-]{25,}\b/g],
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ["aws-access-id", /\bAKIA[A-Z0-9]{16}\b/g],
];
async function files(root) {
  const out = [];
  async function walk(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      require("../services/scan-context").getStore()?.signal?.throwIfAborted();
      if (["node_modules", ".git", "vendor", "dist", "build", ".venv"].includes(entry.name) || entry.isSymbolicLink()) continue;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (entry.isFile() && (await fs.stat(file)).size <= 1024 * 1024) out.push(file);
      if (out.length > 20000) throw new Error("Repository data scan file limit exceeded");
    }
  }
  await walk(root); return out;
}
function finding(scanner, filePath, line, ruleId, title, cwe, severity, description) {
  return { scanner, filePath, startLine: line, endLine: line, ruleId, title, cwe, severity,
    description, evidenceSnippet: "Sensitive values are not retained.", remediation: "" };
}
class SecretsAdapter extends Base {
  constructor() { super("secrets"); this.version = "securepatch-patterns-v1"; }
  async isAvailable() { return true; }
  async scan(root) {
    const entries = await files(root); const results = [];
    for (const file of entries) {
      const text = await fs.readFile(file, "utf8"); if (text.includes("\0")) continue;
      for (const [id, regex] of patterns) {
        regex.lastIndex = 0;
        for (const match of text.matchAll(regex)) {
          if (results.length >= 5000) throw new Error("Credential pattern finding limit exceeded");
          const line = text.slice(0, match.index).split("\n").length;
          results.push(finding("secrets", path.relative(root, file).replace(/\\/g, "/"), line, id,
            "Possible credential material; validate and rotate if real", "CWE-798", "high",
            `Pattern ${id} matched. This is unverified and may be a synthetic example. The matched value was not stored.`));
        }
      }
    }
    this.coverage = require("./process").coverage(entries, root); return results;
  }
}
class DependencyAdapter extends Base {
  constructor() { super("dependency"); this.version = "osv-npm-lock-v1"; }
  async isAvailable() { return true; }
  async scan(root) {
    const locks = (await files(root)).filter(p => path.basename(p) === "package-lock.json");
    const results = []; let queried = 0;
    for (const file of locks) {
      let lock; try { lock = JSON.parse(await fs.readFile(file, "utf8")); } catch { throw new Error("Invalid npm lockfile"); }
      if (![2, 3].includes(lock.lockfileVersion) || !lock.packages) throw new Error("Dependency checks require npm lockfile version 2 or 3");
      const packages = [...new Map(Object.entries(lock.packages).filter(([key, p]) => key.includes("node_modules/") && typeof p.version === "string")
        .map(([key, p]) => { const name = p.name || key.split("node_modules/").pop(); return [`${name}@${p.version}`, { name, version: p.version }]; })).values()];
      if (queried + packages.length > 2000) throw new Error("Dependency checks are capped at 2000 packages per scan");
      for (let start = 0; start < packages.length; start += 100) {
        const batch = packages.slice(start, start + 100);
        const response = await fetch("https://api.osv.dev/v1/querybatch", { method: "POST", headers: { "Content-Type": "application/json" },
          signal: AbortSignal.any([AbortSignal.timeout(15000), ...(require("../services/scan-context").getStore()?.signal ? [require("../services/scan-context").getStore().signal] : [])]),
          body: JSON.stringify({ queries: batch.map(p => ({ package: { ecosystem: "npm", name: p.name }, version: p.version })) }) });
        if (!response.ok) throw new Error("Dependency advisory service unavailable");
        const data = await response.json();
        if (!Array.isArray(data.results) || data.results.length !== batch.length) throw new Error("Invalid advisory response");
        data.results.forEach((result, index) => {
          for (const vuln of result.vulns || []) {
            if (!/^[A-Za-z0-9_.-]{1,150}$/.test(vuln.id || "")) continue;
            results.push(finding("dependency", path.relative(root, file).replace(/\\/g, "/"), 1, `${vuln.id}:${batch[index].name}@${batch[index].version}`,
              `${batch[index].name}@${batch[index].version}: ${vuln.id}`, "CWE-1395", "medium",
              `Advisory match for locked npm package ${batch[index].name}@${batch[index].version}. Severity is unassessed (medium baseline); verify runtime reachability and upstream guidance. See https://osv.dev/vulnerability/${vuln.id}`));
          }
        });
      }
      queried += packages.length;
    }
    this.coverage = { ...require("./process").coverage(locks, root), packages: queried }; return results;
  }
}
module.exports = { SecretsAdapter, DependencyAdapter };

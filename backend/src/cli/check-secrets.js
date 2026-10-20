const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 }).split("\0").filter(Boolean);
let failed = false;
for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  if (/\bnvapi-[A-Za-z0-9_-]{25,}\b|\bgh[pousr]_[A-Za-z0-9_]{25,}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\r?\n[A-Za-z0-9+/=]{40}/.test(content)) {
    console.error(`Possible credential in tracked file: ${file}`); failed = true;
  }
}
if (failed) process.exitCode = 1;
else console.log(`Checked ${files.length} tracked files; no supported credential patterns found.`);

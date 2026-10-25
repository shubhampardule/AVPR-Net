const { Worker } = require("node:worker_threads");
const fs = require("node:fs");
const path = require("node:path");
const { MAX_SOURCE_BYTES } = require("../utils/review-source");

function syntaxWorkerPath() {
  const candidates = [path.join(__dirname, "syntax-worker.js"), path.join(__dirname, "services", "syntax-worker.js")];
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

async function validateCode(language, code, format = "code") {
  if (typeof code !== "string" || Buffer.byteLength(code) > MAX_SOURCE_BYTES) {
    return { status: "failed", executed: false, message: "Proposal exceeds parser input limit" };
  }
  if (format === "diff" || !["python", "javascript", "typescript"].includes(language)) {
    return { status: "unavailable", executed: false, message: format === "diff"
      ? "Unified diff requires manual review; no file was changed or parsed"
      : "No safe parser is configured for this language" };
  }
  return new Promise((resolve) => {
    const worker = new Worker(syntaxWorkerPath(), {
      workerData: { language, code }, resourceLimits: { maxOldGenerationSizeMb: 64 },
      // Do not inherit loader/preload flags into the parser worker.
      execArgv: [],
      env: {},
    });
    let finished = false;
    const finish = (result) => {
      if (finished) return;
      finished = true; clearTimeout(timer); worker.terminate(); resolve(result);
    };
    const timer = setTimeout(() => finish({ status: "unavailable", executed: false,
      message: "Parser deadline exceeded" }), 2000);
    worker.once("message", finish);
    worker.once("error", () => finish({ status: "unavailable", executed: false, message: "Parser unavailable" }));
    worker.once("exit", () => finish({ status: "unavailable", executed: false, message: "Parser exited without a result" }));
  });
}

module.exports = { validateCode };

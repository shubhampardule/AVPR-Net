const path = require("node:path");
const { Worker } = require("node:worker_threads");
const { execFile } = require("node:child_process");

async function validateCode(language, code, format = "code") {
  if (typeof code !== "string" || Buffer.byteLength(code) > 32000) {
    return { status: "failed", executed: false, message: "Proposal exceeds parser input limit" };
  }
  if (format === "diff" || !["python", "javascript", "typescript"].includes(language)) {
    return { status: "unavailable", executed: false, message: format === "diff"
      ? "Unified diff requires manual review; no file was changed or parsed"
      : "No safe parser is configured for this language" };
  }
  if (language === "python") {
    return new Promise((resolve) => {
      // This is trusted parser code. The generated proposal is only stdin data.
      const parser = "import ast,sys; ast.parse(sys.stdin.read(32001)); print('VALID')";
      const child = execFile("python", ["-I", "-c", parser], { timeout: 3000, maxBuffer: 4096,
        windowsHide: true, env: { PATH: process.env.PATH || process.env.Path || "",
          SystemRoot: process.env.SystemRoot || "", TEMP: process.env.TEMP || "", PYTHONNOUSERSITE: "1" } }, (error, stdout, stderr) => {
        if (!error && stdout.trim() === "VALID") {
          resolve({ status: "passed", method: "python-ast", executed: false });
        } else resolve({ status: /SyntaxError|IndentationError|TabError/.test(stderr || "") ? "failed" : "unavailable",
          method: "python-ast", executed: false,
          message: "Python AST check failed or interpreter was unavailable; generated code was not executed" });
      });
      child.stdin.on("error", () => {});
      child.stdin.end(code);
    });
  }
  return new Promise((resolve) => {
    const worker = new Worker(path.join(__dirname, "syntax-worker.js"), {
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

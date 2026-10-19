const { parentPort, workerData } = require("node:worker_threads");
const { parse } = require("@babel/parser");
try {
  parse(workerData.code, { sourceType: "unambiguous",
    plugins: workerData.language === "typescript" ? ["typescript"] : [] });
  parentPort.postMessage({ status: "passed", method: "babel-parser", executed: false });
} catch (error) {
  parentPort.postMessage({ status: "failed", method: "babel-parser", executed: false,
    message: "Syntax parser rejected the proposal", line: error.loc?.line || null });
}

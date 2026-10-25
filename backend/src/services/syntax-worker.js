const { parentPort, workerData } = require("node:worker_threads");
try {
  if (workerData.language === "python") {
    const { parser } = require("@lezer/python");
    const tree = parser.parse(workerData.code);
    let errorNode = null;
    tree.iterate({ enter(node) { if (node.type.isError) { errorNode = node; return false; } } });
    if (errorNode) {
      parentPort.postMessage({ status: "failed", method: "lezer-python", executed: false,
        message: "Syntax parser rejected the proposal", line: workerData.code.slice(0, errorNode.from).split("\n").length });
    } else parentPort.postMessage({ status: "passed", method: "lezer-python", executed: false });
  } else {
    const { parse } = require("@babel/parser");
    parse(workerData.code, { sourceType: "unambiguous",
      plugins: workerData.language === "typescript" ? ["typescript"] : [] });
    parentPort.postMessage({ status: "passed", method: "babel-parser", executed: false });
  }
} catch (error) {
  parentPort.postMessage({ status: "failed", method: workerData.language === "python" ? "lezer-python" : "babel-parser", executed: false,
    message: "Syntax parser rejected the proposal", line: error.loc?.line || null });
}

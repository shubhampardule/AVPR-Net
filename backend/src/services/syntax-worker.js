const { parentPort, workerData } = require("node:worker_threads");
try {
  if (workerData.language === "python") {
    let parser;
    try {
      parser = require("@lezer/python").parser;
    } catch {
      parentPort.postMessage({ status: "unavailable", method: "lezer-python", executed: false,
        message: "Python syntax parser unavailable" });
      return;
    }
    const tree = parser.parse(workerData.code);
    let errorNode = null;
    tree.iterate({ enter(node) { if (node.type.isError) { errorNode = node; return false; } } });
    if (errorNode) {
      const line = workerData.code.slice(0, errorNode.from).split("\n").length;
      parentPort.postMessage({ status: "failed", method: "lezer-python", executed: false,
        message: `Syntax parser rejected the proposal at line ${line}`, line });
    } else {
      parentPort.postMessage({ status: "passed", method: "lezer-python", executed: false });
    }
  } else {
    const { parse } = require("@babel/parser");
    const plugins = workerData.language === "typescript"
      ? ["typescript", "jsx", "decorators-legacy", ["importAttributes", { deprecatedAssertSyntax: true }]]
      : ["jsx", "decorators-legacy", ["importAttributes", { deprecatedAssertSyntax: true }]];
    parse(workerData.code, {
      sourceType: "unambiguous",
      allowReturnOutsideFunction: true,
      allowAwaitOutsideFunction: true,
      allowImportExportEverywhere: true,
      plugins,
    });
    parentPort.postMessage({ status: "passed", method: "babel-parser", executed: false });
  }
} catch (error) {
  if (error.code === "MODULE_NOT_FOUND" || !(error instanceof SyntaxError || error.loc)) {
    parentPort.postMessage({ status: "unavailable", method: workerData.language === "python" ? "lezer-python" : "babel-parser", executed: false,
      message: "Syntax parser unavailable for this proposal" });
  } else {
    parentPort.postMessage({ status: "failed", method: workerData.language === "python" ? "lezer-python" : "babel-parser", executed: false,
      message: error.message || "Syntax parser rejected the proposal", line: error.loc?.line || null });
  }
}


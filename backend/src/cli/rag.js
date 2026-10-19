require("dotenv").config({ quiet: true });
const fs = require("node:fs/promises");
const path = require("node:path");
const { NvidiaService } = require("../services/nvidia.service");
const { RagService } = require("../services/rag.service");

async function main() {
  const rag = new RagService({ provider: new NvidiaService({ logger: require("../config/logger") }) });
  const [command, ...args] = process.argv.slice(2);
  let result;
  if (command === "index" || command === "bundle") {
    const sources = JSON.parse(await fs.readFile(path.resolve(__dirname, "../../knowledge/sources.json"), "utf8"));
    result = await rag.ingest(sources, { rebuild: args.includes("--rebuild") });
    if (command === "bundle") {
      await fs.copyFile(rag.indexPath, path.resolve(__dirname, "../../knowledge/index.json"));
      result.bundled = true;
    }
  } else if (command === "query") result = await rag.retrieve(args.join(" "));
  else if (command === "status") result = await rag.diagnostics();
  else throw new Error("Usage: rag.js index [--rebuild] | bundle | query <text> | status");
  console.log(JSON.stringify(result, null, 2));
}
main().catch((error) => {
  console.error(JSON.stringify({ code: error.code || "RAG_FAILED", message:
    /^(?:RAG_|NVIDIA_)/.test(error.code || "") ? error.message : "Knowledge command failed; check approved sources and local permissions" }));
  process.exitCode = 1;
});

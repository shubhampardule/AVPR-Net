require("dotenv").config({ quiet: true });
const fs = require("node:fs/promises");
const { NvidiaService } = require("../services/nvidia.service");
const { RagService } = require("../services/rag.service");
const { AssistantService } = require("../services/assistant.service");

async function main() {
  const [operation, file] = process.argv.slice(2);
  if (!file || !["analyze", "code"].includes(operation)) throw new Error("Usage: assistant.js analyze|code <JSON fixture>");
  const stat = await fs.stat(file);
  if (stat.size > 16000) throw new Error("Fixture exceeds limit");
  const input = JSON.parse(await fs.readFile(file, "utf8"));
  const provider = new NvidiaService({ logger: require("../config/logger") });
  const service = new AssistantService({ provider, rag: new RagService({ provider }) });
  const result = operation === "analyze" ? await service.analyzeEvent(input) : await service.generateCode(input);
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== "complete") process.exitCode = 1;
}
main().catch((error) => {
  console.error(JSON.stringify({ code: error.code || "ASSISTANT_FAILED", message: "Request failed; check fixture schema and local configuration" }));
  process.exitCode = 1;
});

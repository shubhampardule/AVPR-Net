require("dotenv").config({ quiet: true });
const { NvidiaService } = require("../services/nvidia.service");

async function main() {
  const provider = new NvidiaService({ logger: require("../config/logger") });
  const health = provider.health();
  console.log(JSON.stringify(health, null, 2));
  if (!health.configured) { process.exitCode = 1; return; }
  if (!process.argv.includes("--live")) return;
  // Explicit integration probe; no project code, logs, or user data transmitted.
  const chat = await provider.chat([{ role: "user", content: "Reply with the single word READY." }]);
  if (chat.text.trim() !== "READY") throw new Error("Live chat probe did not return READY");
  const embedding = await provider.embed(["Synthetic defensive security diagnostic."], "query");
  console.log(JSON.stringify({ reachable: true, chatRequestId: chat.requestId,
    embeddingRequestId: embedding.requestId, dimensions: embedding.dimensions }));
}

main().catch((error) => {
  console.error(JSON.stringify({ code: error.code || "DIAGNOSTIC_FAILED",
    message: error.code ? error.message : "Diagnostic failed", requestId: error.requestId }));
  process.exitCode = 1;
});

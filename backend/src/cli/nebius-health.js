require("dotenv").config({ quiet: true });
const { NvidiaService } = require("../services/nvidia.service");
const { defaultBudgetService } = require("../services/ai-budget.service");

async function main() {
  const provider = new NvidiaService({ logger: require("../config/logger") });
  const health = provider.health();

  console.log("=== Nebius Token Factory & NVIDIA Model Health Check ===");
  console.log(JSON.stringify(health, null, 2));

  const usage = defaultBudgetService.getUsage();
  console.log("\n=== Credit & Token Budget Status ===");
  console.log(`Max Credits:      $${usage.maxCredits.toFixed(2)}`);
  console.log(`Estimated Spend:  $${usage.estimatedCostCredits.toFixed(6)}`);
  console.log(`Remaining Budget: $${usage.remainingCredits.toFixed(6)} (${(100 - usage.percentUsed).toFixed(1)}%)`);
  console.log(`Total Tokens:     ${usage.totalTokens} (Prompt: ${usage.totalPromptTokens}, Completion: ${usage.totalCompletionTokens})`);
  console.log(`Status:           ${usage.status.toUpperCase()}`);

  if (!health.configured) {
    console.log("\n[Notice] No NEBIUS_API_KEY (or NVIDIA_API_KEY) found in environment.");
    console.log("When you claim your promo credits, add them to backend/.env:");
    console.log("  NEBIUS_API_KEY=your_key_here");
    console.log("  NEBIUS_BUDGET_CREDITS=25.0");
    return;
  }

  if (!process.argv.includes("--live")) {
    console.log("\nConfiguration verified. Pass --live to send a single 5-token live ping.");
    return;
  }

  console.log("\nSending minimal diagnostic ping to Nebius Token Factory...");
  const started = Date.now();
  const chat = await provider.chat([{ role: "user", content: "Reply with the single word READY." }]);
  const duration = Date.now() - started;

  console.log(`Response received in ${duration}ms: "${chat.text.trim()}"`);
  console.log(`Request ID: ${chat.requestId}`);
  console.log(`Model Used: ${chat.model}`);

  const postUsage = defaultBudgetService.getUsage();
  console.log(`Updated Estimated Spend: $${postUsage.estimatedCostCredits.toFixed(6)} (Remaining: $${postUsage.remainingCredits.toFixed(6)})`);
}

main().catch((error) => {
  console.error(JSON.stringify({
    code: error.code || "DIAGNOSTIC_FAILED",
    message: error.message || "Nebius diagnostic failed",
    requestId: error.requestId,
  }, null, 2));
  process.exitCode = 1;
});

const fs = require("node:fs");
const path = require("node:path");

class AiBudgetService {
  constructor({
    maxCredits = 25.0,
    storagePath = path.resolve(process.cwd(), ".local/nebius-usage.json"),
    provider = "nebius",
  } = {}) {
    this.maxCredits = Number.isFinite(Number(maxCredits)) && Number(maxCredits) > 0 ? Number(maxCredits) : 25.0;
    this.storagePath = storagePath;
    this.provider = provider;
    this.state = this._load();
  }

  _load() {
    try {
      if (this.storagePath && fs.existsSync(this.storagePath)) {
        const raw = fs.readFileSync(this.storagePath, "utf8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          return {
            totalPromptTokens: Number(parsed.totalPromptTokens) || 0,
            totalCompletionTokens: Number(parsed.totalCompletionTokens) || 0,
            totalTokens: Number(parsed.totalTokens) || 0,
            totalRequests: Number(parsed.totalRequests) || 0,
            estimatedCostCredits: Number(parsed.estimatedCostCredits) || 0,
            lastUpdated: parsed.lastUpdated || new Date().toISOString(),
          };
        }
      }
    } catch (_) {
      // Fallback to fresh state if file read or parse fails
    }
    return {
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalTokens: 0,
      totalRequests: 0,
      estimatedCostCredits: 0,
      lastUpdated: new Date().toISOString(),
    };
  }

  _persist() {
    try {
      if (!this.storagePath) return;
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.storagePath, JSON.stringify(this.state, null, 2), "utf8");
    } catch (_) {
      // Best effort local persistence
    }
  }

  /**
   * Estimate token cost in credits (USD equivalent on Nebius Token Factory).
   * Models like nvidia/Nemotron-3_5-Lightning are ~$0.15 per 1M tokens.
   */
  _computeCost(promptTokens, completionTokens, model = "") {
    let ratePerMillion = 0.20; // conservative default ($0.20 per 1M tokens)
    const lower = String(model).toLowerCase();
    if (lower.includes("lightning") || lower.includes("nano")) {
      ratePerMillion = 0.15;
    } else if (lower.includes("super-120b") || lower.includes("ultra")) {
      ratePerMillion = 0.60;
    }
    const cost = ((promptTokens + completionTokens) * ratePerMillion) / 1000000;
    return Math.max(0, cost);
  }

  checkBudget(estimatedTokens = 2048) {
    const estimatedCost = this._computeCost(estimatedTokens, estimatedTokens);
    if (this.state.estimatedCostCredits >= this.maxCredits ||
        (this.state.estimatedCostCredits + estimatedCost) > (this.maxCredits + 0.5)) {
      const err = new Error(
        `Nebius Token Factory credit budget limit (${this.maxCredits.toFixed(2)} credits) reached. Inference paused to prevent credit overage.`
      );
      err.code = "AI_BUDGET_EXCEEDED";
      err.status = 429;
      throw err;
    }
  }

  recordUsage({ promptTokens = 0, completionTokens = 0, totalTokens = null, model = "" } = {}) {
    const prompt = Number.isSafeInteger(promptTokens) && promptTokens > 0 ? promptTokens : 0;
    const completion = Number.isSafeInteger(completionTokens) && completionTokens > 0 ? completionTokens : 0;
    const total = Number.isSafeInteger(totalTokens) && totalTokens > 0 ? totalTokens : (prompt + completion);

    const cost = this._computeCost(prompt, completion, model);
    this.state.totalPromptTokens += prompt;
    this.state.totalCompletionTokens += completion;
    this.state.totalTokens += total;
    this.state.totalRequests += 1;
    this.state.estimatedCostCredits += cost;
    this.state.lastUpdated = new Date().toISOString();

    this._persist();
    return this.getUsage();
  }

  getUsage() {
    const remaining = Math.max(0, this.maxCredits - this.state.estimatedCostCredits);
    const percentUsed = (this.state.estimatedCostCredits / this.maxCredits) * 100;
    return {
      provider: this.provider,
      maxCredits: this.maxCredits,
      estimatedCostCredits: Number(this.state.estimatedCostCredits.toFixed(6)),
      remainingCredits: Number(remaining.toFixed(6)),
      percentUsed: Number(percentUsed.toFixed(2)),
      totalPromptTokens: this.state.totalPromptTokens,
      totalCompletionTokens: this.state.totalCompletionTokens,
      totalTokens: this.state.totalTokens,
      totalRequests: this.state.totalRequests,
      status: this.state.estimatedCostCredits >= this.maxCredits
        ? "limit_exceeded"
        : percentUsed >= 80
        ? "warning"
        : "active",
      lastUpdated: this.state.lastUpdated,
    };
  }

  reset() {
    this.state = {
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalTokens: 0,
      totalRequests: 0,
      estimatedCostCredits: 0,
      lastUpdated: new Date().toISOString(),
    };
    this._persist();
  }
}

// Export singleton instance as well as class
const defaultBudgetService = new AiBudgetService();

module.exports = {
  AiBudgetService,
  defaultBudgetService,
};

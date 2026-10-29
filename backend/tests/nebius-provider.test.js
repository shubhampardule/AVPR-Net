const { NvidiaService, NvidiaError } = require("../src/services/nvidia.service");
const { getNvidiaConfig } = require("../src/config/nvidia");
const { AiBudgetService } = require("../src/services/ai-budget.service");

describe("Nebius Token Factory & NVIDIA Open Model Provider", () => {
  describe("getNvidiaConfig with Nebius", () => {
    test("detects Nebius provider when NEBIUS_API_KEY is present", () => {
      const config = getNvidiaConfig({
        NEBIUS_API_KEY: "nebius-secret-key-12345",
      });
      expect(config.provider).toBe("nebius");
      expect(config.providerName).toBe("Nebius Token Factory");
      expect(config.baseUrl).toBe("https://api.tokenfactory.nebius.com/v1");
      expect(config.chatModel).toBe("nvidia/Nemotron-3_5-Lightning");
      expect(config.apiKey).toBe("nebius-secret-key-12345");
      expect(config.maxCredits).toBe(25.0);
    });

    test("allows custom Nebius base URL and custom NVIDIA model", () => {
      const config = getNvidiaConfig({
        NEBIUS_API_KEY: "nebius-key",
        NEBIUS_BASE_URL: "https://custom.tokenfactory.nebius.ai/v1",
        NEBIUS_CHAT_MODEL: "nvidia/nemotron-3-super-120b-a12b",
        NEBIUS_BUDGET_CREDITS: "15.5",
      });
      expect(config.provider).toBe("nebius");
      expect(config.baseUrl).toBe("https://custom.tokenfactory.nebius.ai/v1");
      expect(config.chatModel).toBe("nvidia/nemotron-3-super-120b-a12b");
      expect(config.maxCredits).toBe(15.5);
    });

    test("rejects invalid Nebius base URL or budget credits", () => {
      expect(() => getNvidiaConfig({
        NEBIUS_API_KEY: "key",
        NEBIUS_BASE_URL: "http://insecure.nebius.com/v1",
      })).toThrow("NEBIUS_BASE_URL must be an HTTPS URL without credentials, query or fragment");

      expect(() => getNvidiaConfig({
        NEBIUS_API_KEY: "key",
        NEBIUS_BUDGET_CREDITS: "-5",
      })).toThrow("NEBIUS_BUDGET_CREDITS must be a number between 0.1 and 1000");
    });
  });

  describe("AiBudgetService Guardrail", () => {
    test("tracks token usage and calculates estimated cost for Nemotron-3.5 Lightning", () => {
      const budget = new AiBudgetService({ maxCredits: 25.0, storagePath: null });
      expect(budget.getUsage()).toMatchObject({
        maxCredits: 25.0,
        estimatedCostCredits: 0,
        remainingCredits: 25.0,
        totalTokens: 0,
        status: "active",
      });

      // Record 10,000 prompt tokens and 2,000 completion tokens
      budget.recordUsage({
        promptTokens: 10000,
        completionTokens: 2000,
        model: "nvidia/Nemotron-3_5-Lightning",
      });

      const usage = budget.getUsage();
      expect(usage.totalPromptTokens).toBe(10000);
      expect(usage.totalCompletionTokens).toBe(2000);
      expect(usage.totalTokens).toBe(12000);
      expect(usage.totalRequests).toBe(1);
      // Cost at $0.15 / 1M tokens: 12,000 * 0.15 / 1,000,000 = $0.0018
      expect(usage.estimatedCostCredits).toBeCloseTo(0.0018, 5);
      expect(usage.remainingCredits).toBeCloseTo(25.0 - 0.0018, 4);
      expect(usage.status).toBe("active");
    });

    test("enforces budget cap and throws AI_BUDGET_EXCEEDED when limit is reached", () => {
      const budget = new AiBudgetService({ maxCredits: 0.005, storagePath: null });

      // First call stays under
      budget.recordUsage({
        promptTokens: 5000,
        completionTokens: 1000,
        model: "nvidia/Nemotron-3_5-Lightning",
      });
      expect(() => budget.checkBudget(500)).not.toThrow();

      // Second call pushes over 0.005 budget
      budget.recordUsage({
        promptTokens: 30000,
        completionTokens: 10000,
        model: "nvidia/Nemotron-3_5-Lightning",
      });

      expect(() => budget.checkBudget(1000)).toThrow(
        /Nebius Token Factory credit budget limit .* reached/
      );
      expect(budget.getUsage().status).toBe("limit_exceeded");
    });

    test("warns when budget exceeds 80%", () => {
      const budget = new AiBudgetService({ maxCredits: 0.01, storagePath: null });
      // 55,000 tokens * 0.15 / 1M = 0.00825 (82.5% of 0.01)
      budget.recordUsage({
        promptTokens: 50000,
        completionTokens: 5000,
        model: "nvidia/Nemotron-3_5-Lightning",
      });
      expect(budget.getUsage().status).toBe("warning");
      expect(budget.getUsage().percentUsed).toBeGreaterThanOrEqual(80);
    });
  });

  describe("NvidiaService integration with Nebius and budget guardrail", () => {
    test("reports Nebius provider and budget info in health()", () => {
      const env = { NEBIUS_API_KEY: "test-nebius-key" };
      const budget = new AiBudgetService({ maxCredits: 25.0, storagePath: null });
      const service = new NvidiaService({ env, budgetService: budget });

      const health = service.health();
      expect(health).toMatchObject({
        configured: true,
        provider: "nebius",
        providerName: "Nebius Token Factory",
        chatModel: "nvidia/Nemotron-3_5-Lightning",
        budget: expect.objectContaining({
          maxCredits: 25.0,
          status: "active",
        }),
      });
    });

    test("records token usage from chat completion response and blocks when budget exceeded", async () => {
      const env = { NEBIUS_API_KEY: "test-nebius-key" };
      const budget = new AiBudgetService({ maxCredits: 0.0001, storagePath: null });
      const reply = {
        choices: [{ finish_reason: "stop", message: { content: "READY" } }],
        usage: { prompt_tokens: 200, completion_tokens: 50, total_tokens: 250 },
      };
      const fetchImpl = jest.fn().mockResolvedValue(
        new Response(JSON.stringify(reply), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      );

      const service = new NvidiaService({ env, fetchImpl, budgetService: budget });

      // First chat consumes tokens
      const result = await service.chat([{ role: "user", content: "hello" }]);
      expect(result.text).toBe("READY");
      expect(budget.getUsage().totalTokens).toBe(250);

      // Now exhaust the tiny 0.0001 budget
      budget.recordUsage({ promptTokens: 2000, completionTokens: 1000, model: "nvidia/Nemotron-3_5-Lightning" });

      // Next chat call is blocked by budget guardrail before fetch is called again
      fetchImpl.mockClear();
      await expect(service.chat([{ role: "user", content: "hello again" }]))
        .rejects.toMatchObject({ code: "AI_BUDGET_EXCEEDED" });
      expect(fetchImpl).not.toHaveBeenCalled();
    });
  });
});

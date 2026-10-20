import { test, expect } from "@playwright/test";

const demoFixtures = {
  events: {
    suspicious: { id: "evt-public-1", timestamp: "2026-10-20T12:00:00Z", category: "authentication", synthetic: true, failed_attempts: 12 },
    benign: { id: "evt-public-2", timestamp: "2026-10-20T12:00:00Z", category: "service_check", synthetic: true, connections: 2 },
  },
  code: {
    javascript: { language: "javascript", mode: "generate", request: "Use safe input handling.", originalCode: "" },
    python: { language: "python", mode: "generate", request: "Validate untrusted values.", originalCode: "" },
    typescript: { language: "typescript", mode: "generate", request: "Write a safe TypeScript validator.", originalCode: "" },
    c: { language: "c", mode: "generate", request: "Write a safe C parser.", originalCode: "" },
    cpp: { language: "cpp", mode: "generate", request: "Write a safe C++ parser.", originalCode: "" },
    bash: { language: "bash", mode: "generate", request: "Validate shell inputs.", originalCode: "" },
    review: { language: "javascript", mode: "review", request: "Review this port parser.", originalCode: "export function validatePort(value) { return parseInt(value, 10); }\n" },
  },
  provenance: "Synthetic public-controls fixture",
};

async function mockPublicApis(page) {
  await page.addInitScript(() => {
    window.__publicControlsCopiedText = "";
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (text) => { window.__publicControlsCopiedText = text; } },
    });
  });

  await page.route("**/api/v1/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    let status = 200;
    let data = {};

    if (pathname.endsWith("/auth/me")) {
      status = 401;
      data = { success: false };
    } else if (pathname.endsWith("/ai/demo/health")) {
      data = { status: "configured", languages: ["javascript", "python", "typescript", "c", "cpp", "bash"], execution: "disabled", demo: true };
    } else if (pathname.endsWith("/ai/demo/knowledge")) {
      data = { chunks: 2, sources: ["approved-security-guide.md"] };
    } else if (pathname.endsWith("/ai/demo/fixtures")) {
      data = demoFixtures;
    } else if (pathname.endsWith("/organizations")) {
      data = { organizations: [] };
    } else if (pathname.endsWith("/organizations/invitations/accept")) {
      status = 400;
      data = { error: { message: "This invitation could not be accepted." } };
    }

    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ success: status < 400, data }) });
  });
}

function capturePageErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test.beforeEach(async ({ page }) => {
  await mockPublicApis(page);
});

test("desktop navigation, hero links, and logo anchors reach their destinations", async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");

  const nav = page.locator("header nav");
  for (const [label, hash] of [["Product", "#product"], ["How it works", "#workflow"], ["Security", "#security"], ["Playground", "#playground"], ["Capabilities", "#capabilities"]]) {
    await nav.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${hash.replace("#", "\\#")}$`));
    await expect(page.locator(hash)).toBeAttached();
  }

  await nav.getByRole("link", { name: "AI assistant", exact: true }).click();
  await expect(page).toHaveURL(/\/assistant-demo$/);
  await expect(page.getByRole("heading", { name: "Evidence before action." })).toBeVisible();

  await page.goto("/");
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/");
  await page.locator("header").getByRole("link", { name: "Start scanning", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/");
  await page.getByRole("link", { name: "See how it works" }).click();
  await expect(page).toHaveURL(/#workflow$/);
  await page.locator("header").getByRole("link").first().click();
  await expect(page).toHaveURL(/\/$/);
  expect(errors).toEqual([]);
});

test("mobile navigation opens, closes, and follows every menu link", async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const toggle = page.getByRole("button", { name: "Toggle navigation menu" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");

  const menu = page.locator("header nav:visible");
  for (const [label, hash] of [["Product", "#product"], ["How it works", "#workflow"], ["Security", "#security"], ["Playground", "#playground"], ["Capabilities", "#capabilities"]]) {
    await menu.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${hash.replace("#", "\\#")}$`));
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
  }

  await menu.getByRole("link", { name: "AI assistant", exact: true }).click();
  await expect(page).toHaveURL(/\/assistant-demo$/);
  await page.goto("/");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await page.locator("header").getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await page.locator("header").getByRole("link", { name: "Start scanning", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(errors).toEqual([]);
});

test("hero scan link and all four terminal stage controls update the illustration", async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.goto("/");

  await page.locator("#product").getByRole("link", { name: "Start scanning" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/");
  const terminal = page.locator("#product").locator(".relative.rounded-xl").first();
  const states = [
    ["Detection", "Unsanitized Query String Interpolation"],
    ["Risk Analysis", "9.2 / 10 (Direct)"],
    ["Patch Generated", "Targeted Unified Diff Generated"],
    ["Review", "Illustration only. Run independent tests before merging."],
  ];
  for (const [label, result] of states) {
    await terminal.getByRole("button", { name: new RegExp(label) }).click();
    await expect(terminal.getByText(result, { exact: false })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("workflow stepper, previous/next controls, scanner filters, prioritization, remediation, and verification work", async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.goto("/");
  const workflow = page.locator("#workflow");
  await expect(workflow.getByRole("heading", { name: "See what's hiding in your code." })).toBeVisible();

  await workflow.getByRole("button", { name: /Next: PRIORITIZE/ }).click();
  await expect(workflow.getByRole("heading", { name: "Not every vulnerability deserves the same urgency." })).toBeVisible();
  await workflow.getByRole("button", { name: "← Previous Stage" }).click();
  await workflow.getByRole("button", { name: /Next: PRIORITIZE/ }).click();

  for (const [title, exploitability] of [["Hardcoded Cloud Secret", "8.2"], ["Weak Cryptography (DES / MD5)", "4.8"]]) {
    const choice = workflow.getByRole("button", { name: title });
    await choice.click();
    await expect(choice).toHaveAttribute("aria-pressed", "true");
    await expect(workflow.getByRole("heading", { name: title })).toBeVisible();
    await expect(workflow.getByText(`${exploitability} / 10`, { exact: true })).toBeVisible();
  }
  const keyboardChoice = workflow.getByRole("button", { name: /SQL Injection.*CWE-89/ });
  await keyboardChoice.focus();
  await page.keyboard.press("Space");
  await expect(keyboardChoice).toHaveAttribute("aria-pressed", "true");

  await workflow.getByRole("button", { name: "03 REMEDIATE" }).click();
  await expect(workflow.getByText("src/routes/login.js", { exact: true })).toBeVisible();
  await workflow.getByRole("button", { name: /CWE-78: Python Command Injection/ }).click();
  await expect(workflow.getByText("services/transcoder.py", { exact: true })).toBeVisible();
  await workflow.getByRole("button", { name: "Unified Diff" }).click();
  await expect(workflow.getByText("subprocess.run(safe_cmd, shell=False", { exact: false })).toBeVisible();
  await workflow.getByRole("button", { name: "Split View" }).click();
  await expect(workflow.getByText("Vulnerable Code (Before)")).toBeVisible();
  await workflow.getByRole("button", { name: /CWE-89: Node.js SQL Injection/ }).click();
  await expect(workflow.getByText("src/routes/login.js", { exact: true })).toBeVisible();

  await workflow.getByRole("button", { name: "04 VERIFY" }).click();
  await expect(workflow.getByText("VALIDATION CAPABILITIES · NO FABRICATED PASS RESULTS")).toBeVisible();
  await expect(workflow.getByText("Human review", { exact: true })).toBeVisible();
  await workflow.getByRole("button", { name: "← Previous Stage" }).click();
  await expect(workflow.getByRole("heading", { name: "From finding to fix." })).toBeVisible();

  await workflow.getByRole("button", { name: "01 DISCOVER" }).click();
  const findingCards = workflow.locator(".group.relative.rounded-lg");
  for (const [filter, count] of [["ALL", 4], ["SEMGREP", 1], ["BANDIT", 1], ["CREDENTIAL PATTERNS", 1], ["SAST EXAMPLE", 1]]) {
    await workflow.getByRole("button", { name: filter, exact: true }).click();
    await expect(findingCards).toHaveCount(count);
  }
  expect(errors).toEqual([]);
});

test("playground scenarios, all view tabs, patch formats, and code-copy action work", async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.goto("/");
  const playground = page.locator("#playground");
  const scenarioButtons = playground.getByRole("button").filter({ hasText: /CWE-/ });
  const count = await scenarioButtons.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i += 1) {
    const button = scenarioButtons.nth(i);
    const category = (await button.locator("span").nth(1).textContent()).trim();
    await button.click();
    await expect(playground.getByRole("heading", { level: 3 }).first()).toHaveText(category);
  }

  await playground.getByRole("button", { name: "Unified Diff" }).click();
  await expect(playground.getByText(/@@/).first()).toBeVisible();
  await playground.getByRole("button", { name: "Split View" }).click();
  await expect(playground.getByText("Vulnerable Code (Before)")).toBeVisible();

  await playground.getByRole("button", { name: "Source Code" }).click();
  const copyButton = playground.getByRole("button", { name: "Copy code to clipboard" });
  await copyButton.click();
  await expect(playground.getByRole("button", { name: "Code copied to clipboard" })).toBeVisible();
  expect(await page.evaluate(() => window.__publicControlsCopiedText)).toContain("VULNERABLE");

  await playground.getByRole("button", { name: "Risk Scoring" }).click();
  await expect(playground.getByText("Exploitability Vectors")).toBeVisible();
  await expect(playground.getByText("Business Impact Evaluation")).toBeVisible();
  await playground.getByRole("button", { name: "Verification" }).click();
  await expect(playground.getByText("VALIDATION CAPABILITIES · NO FABRICATED PASS RESULTS")).toBeVisible();
  expect(errors).toEqual([]);
});

test("final call-to-action modal supports keyboard, close, backdrop, and repository navigation", async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.goto("/");
  const finalCta = page.getByRole("button", { name: "Start scanning", exact: true });
  await finalCta.scrollIntoViewIfNeeded();
  await finalCta.click();

  let dialog = page.getByRole("dialog", { name: "Scan your GitHub repository" });
  await expect(dialog).toBeVisible();
  const close = dialog.getByRole("button", { name: "Close dialog" });
  await expect(close).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("link", { name: "Open repositories" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(close).toBeFocused();
  await close.click();
  await expect(dialog).toBeHidden();

  await finalCta.click();
  dialog = page.getByRole("dialog", { name: "Scan your GitHub repository" });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await finalCta.click();
  dialog = page.getByRole("dialog", { name: "Scan your GitHub repository" });
  await dialog.getByRole("heading", { name: "Scan your GitHub repository" }).click();
  await expect(dialog).toBeVisible();
  await dialog.locator("xpath=..").click({ position: { x: 3, y: 3 } });
  await expect(dialog).toBeHidden();

  await finalCta.click();
  dialog = page.getByRole("dialog", { name: "Scan your GitHub repository" });
  const repositories = dialog.getByRole("link", { name: "Open repositories" });
  await expect(repositories).toHaveAttribute("href", "/github");
  await repositories.click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Secure your codebase." })).toBeVisible();
  expect(errors).toEqual([]);
});

test("footer links reach each section and final CTA explainer reaches the workflow", async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.goto("/");
  const footer = page.locator("footer");
  for (const [label, hash] of [["Product", "#product"], ["Workflow", "#workflow"], ["Playground", "#playground"], ["Architecture", "#capabilities"]]) {
    await footer.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${hash.replace("#", "\\#")}$`));
  }
  await page.getByRole("link", { name: "Explore SecurePatch" }).click();
  await expect(page).toHaveURL(/#workflow$/);
  expect(errors).toEqual([]);
});

test("both login providers start mocked OAuth handoffs and return-home links work", async ({ page }) => {
  const errors = capturePageErrors(page);
  for (const provider of ["github", "google"]) {
    await page.route(`**/api/v1/auth/${provider}**`, (route) => route.fulfill({
      status: 200,
      contentType: "text/html",
      body: `Mocked ${provider} OAuth handoff`,
    }));
    await page.goto("/login?returnTo=%2Fassistant");
    const label = provider === "github" ? "Continue with GitHub" : "Continue with Google";
    await page.getByRole("button", { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`/api/v1/auth/${provider}\\?returnTo=%2Fassistant$`));
    await expect(page.locator("body")).toContainText(`Mocked ${provider} OAuth handoff`);
    await page.unroute(`**/api/v1/auth/${provider}**`);
  }

  await page.goto("/login?error=github_denied");
  await expect(page.getByRole("alert")).toHaveText("GitHub sign-in was not completed. Please try again.");
  await page.getByRole("link", { name: "Return home" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: /Find the vulnerability/i })).toBeVisible();
  expect(errors).toEqual([]);
});

test("invitation missing, unauthenticated, expired, and accepted states validate correctly", async ({ page }) => {
  const errors = capturePageErrors(page);

  await page.goto("/invite/accept");
  await expect(page.getByRole("alert")).toHaveText("This invitation link is missing its token.");

  await page.goto("/invite/accept?token=public-fixture");
  await expect(page).toHaveURL(/\/login\?returnTo=%2Finvite%2Faccept%3Ftoken%3Dpublic-fixture$/);
  await expect(page.getByRole("heading", { name: "Secure your codebase." })).toBeVisible();

  await page.route("**/api/v1/auth/me", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ success: true, data: { user: { id: "public-user", name: "Public Test User" } } }),
  }));
  await page.route("**/api/v1/organizations/invitations/accept", (route) => route.fulfill({
    status: 410,
    contentType: "application/json",
    body: JSON.stringify({ success: false, error: { message: "This invitation has expired." } }),
  }));
  await page.goto("/invite/accept?token=expired-fixture");
  await expect(page.getByRole("alert")).toHaveText("This invitation has expired.");

  await page.unroute("**/api/v1/organizations/invitations/accept");
  await page.route("**/api/v1/organizations/invitations/accept", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ success: true, data: { organization: { id: "public-org", name: "Demo Organization" } } }),
  }));
  await page.route("**/api/v1/organizations", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ success: true, data: { organizations: [{ id: "public-org", name: "Demo Organization", role: "owner" }] } }),
  }));
  await page.route("**/api/v1/dashboard/organizations/public-org", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ success: true, data: {
      organization: { id: "public-org", name: "Demo Organization" }, repositories: { connected: false, total: 0 },
      totals: { scans: 0, findings: 0, criticalAndHigh: 0 },
      riskDistribution: { critical: 0, high: 0, medium: 0, low: 0 }, recentScans: [], priorityFindings: [], scannerStatus: {},
    } }),
  }));

  await page.goto("/invite/accept?token=valid-fixture");
  await expect(page.getByText("You joined Demo Organization.")).toBeVisible();
  const workspace = page.getByRole("link", { name: "Open workspace" });
  await expect(workspace).toHaveAttribute("href", "/dashboard");
  await workspace.click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Demo Organization" })).toBeVisible();
  expect(errors).toEqual([]);
});

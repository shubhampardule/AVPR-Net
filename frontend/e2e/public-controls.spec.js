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

test("appearance toggle changes the palette smoothly and remembers the choice", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", "/favicon.svg?v=3");
  await expect(page.locator("header img")).toHaveAttribute("src", "/favicon.svg?v=3");
  await page.evaluate(() => document.documentElement.classList.add("theme-changing"));
  expect(await page.locator("h1").evaluate(element => getComputedStyle(element).transitionDuration)).toContain("0.28s");
  await page.evaluate(() => document.documentElement.classList.remove("theme-changing"));

  await page.getByRole("button", { name: "Use light appearance" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", "/favicon-light.svg?v=3");
  await expect(page.locator("header img")).toHaveAttribute("src", "/favicon-light.svg?v=3");
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(246, 246, 245)");
  await expect(page.getByRole("button", { name: "Use dark appearance" })).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", "/favicon-light.svg?v=3");
  await expect(page.locator("header img")).toHaveAttribute("src", "/favicon-light.svg?v=3");
  await page.getByRole("button", { name: "Use dark appearance" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", "/favicon.svg?v=3");
  await expect(page.locator("header img")).toHaveAttribute("src", "/favicon.svg?v=3");
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(16, 16, 19)");
});

test("home and sign-in stay within narrow mobile and desktop viewports", async ({ page }) => {
  await page.goto("/");
  for (const width of [320, 360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const pageWidth = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
    expect(pageWidth.document, `home document overflow at ${width}px`).toBeLessThanOrEqual(width);
    expect(pageWidth.body, `home body overflow at ${width}px`).toBeLessThanOrEqual(width);
  }

  await page.goto("/login");
  await page.setViewportSize({ width: 320, height: 844 });
  const signInWidth = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  expect(signInWidth.document).toBeLessThanOrEqual(320);
  expect(signInWidth.body).toBeLessThanOrEqual(320);
});

test("compact pixel-art AVPR-Net robot mark loads in public and sign-in headers", async ({ page }) => {
  const icon = await page.request.get("/favicon.svg?v=3");
  expect(icon.ok()).toBeTruthy();
  expect(icon.headers()["content-type"]).toContain("image/svg+xml");

  await page.goto("/");
  const publicBrand = page.locator('header a[aria-label="AVPR-Net home"]');
  await expect(publicBrand).toContainText("AVPR-Net");
  const publicMark = publicBrand.locator("img");
  await expect(publicMark).toBeVisible();
  await expect.poll(() => publicMark.evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect.poll(() => publicMark.evaluate((image) => getComputedStyle(image).imageRendering)).toBe("pixelated");
  await expect.poll(() => publicMark.evaluate((image) => getComputedStyle(image).width)).toBe("24px");

  await page.goto("/login");
  const signInBrand = page.locator('header a[aria-label="AVPR-Net home"]');
  await expect(signInBrand).toContainText("AVPR-Net");
  const signInMark = signInBrand.locator("img");
  await expect(signInMark).toBeVisible();
  await expect.poll(() => signInMark.evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect.poll(() => signInMark.evaluate((image) => getComputedStyle(image).imageRendering)).toBe("pixelated");
  await expect.poll(() => signInMark.evaluate((image) => getComputedStyle(image).width)).toBe("24px");
});

test("desktop navigation, hero links, and logo anchors reach their destinations", async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");

  const nav = page.locator("header nav");
  for (const [label, hash] of [["Workflow", "#workflow"], ["Example", "#playground"], ["Capabilities", "#capabilities"]]) {
    await nav.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${hash.replace("#", "\\#")}$`));
    await expect(page.locator(hash)).toBeAttached();
  }

  await nav.getByRole("link", { name: "AI assistant", exact: true }).click();
  await expect(page).toHaveURL(/\/assistant-demo$/);
  await expect(page.getByRole("heading", { name: "AI assistant" })).toBeVisible();

  await page.goto("/");
  await page.locator("header").getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/");
  await expect(page.locator("header").getByRole("link", { name: "Connect a repository", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Connect a repository", exact: true })).toHaveCount(1);

  await page.goto("/");
  await page.getByRole("link", { name: "View an example" }).click();
  await expect(page).toHaveURL(/#playground$/);
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
  for (const [label, hash] of [["Workflow", "#workflow"], ["Example", "#playground"], ["Capabilities", "#capabilities"]]) {
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
  await expect(page.locator("header").getByRole("link", { name: "Connect a repository", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Connect a repository", exact: true })).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("hero links lead to sign-in or the sample and preview data is labeled", async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.goto("/");

  await page.locator("#product").getByRole("link", { name: "Connect a repository" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Review repository security in one workspace." })).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("region", { name: "Sample repository overview" })).toHaveCount(0);
  await expect(page.locator("#playground").getByText(/No repository scan runs here/)).toBeVisible();
  await page.getByRole("link", { name: "View an example" }).click();
  await expect(page).toHaveURL(/#playground$/);
  expect(errors).toEqual([]);
});

test("workflow explains the three review steps without repeating the interactive example", async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.goto("/");
  const workflow = page.locator("#workflow");
  await expect(workflow.getByRole("heading", { name: "How a finding moves through review." })).toBeVisible();
  for (const step of ["Scan a commit", "Review the evidence", "Evaluate a change"]) {
    await expect(workflow.getByRole("heading", { name: step })).toBeVisible();
  }
  await expect(workflow.getByRole("listitem")).toHaveCount(3);
  await expect(workflow.getByRole("button")).toHaveCount(0);
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
  await expect(playground.getByText("Exploitability factors")).toBeVisible();
  await expect(playground.getByText("Business impact", { exact: true }).first()).toBeVisible();
  await playground.getByRole("button", { name: "Verification" }).click();
  await expect(playground.getByText("What these checks cover")).toBeVisible();
  expect(errors).toEqual([]);
});

test("final call-to-action goes straight to sign-in without an extra dialog", async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.goto("/");
  const finalCta = page.getByRole("link", { name: "Continue to sign in", exact: true });
  await finalCta.scrollIntoViewIfNeeded();
  await expect(finalCta).toHaveAttribute("href", "/login");
  await finalCta.click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Review repository security in one workspace." })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("footer stays minimal without repeated navigation, branding, or sign-in", async ({ page }) => {
  await page.goto("/");
  const footer = page.locator("footer");
  await expect(footer).toHaveText(`© ${new Date().getFullYear()} AVPR-Net`);
  await expect(footer.getByRole("link")).toHaveCount(0);
  await expect(footer.getByRole("navigation")).toHaveCount(0);
  await expect(footer.locator("img")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Continue to sign in", exact: true })).toHaveCount(1);
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
  await expect(page.getByRole("heading", { name: /Review security findings in their source context/i })).toBeVisible();
  expect(errors).toEqual([]);
});

test("invitation missing, unauthenticated, expired, and accepted states validate correctly", async ({ page }) => {
  const errors = capturePageErrors(page);

  await page.goto("/invite/accept");
  await expect(page.getByRole("alert")).toHaveText("This invitation link is missing its token.");

  await page.goto("/invite/accept?token=public-fixture");
  await expect(page).toHaveURL(/\/login\?returnTo=%2Finvite%2Faccept%3Ftoken%3Dpublic-fixture$/);
  await expect(page.getByRole("heading", { name: "Review repository security in one workspace." })).toBeVisible();

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

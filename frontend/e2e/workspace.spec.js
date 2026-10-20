import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  let hostedAiEnabled = true;
  let latestScan = { _id: "scan-1", owner: "team", repo: "project", organization: "test-org", createdAt: "2026-10-20T00:00:00Z", commitSha: "abc123456789", status: "completed", summary: { total: 1 } };
  let automationSettings = { push: false, pullRequest: false, frequency: "off" };
  await page.route("**/api/v1/**", async route => {
    const url = new URL(route.request().url()); let data;
    if (url.pathname.endsWith("/auth/me")) data = { user: { id: "test-user", name: "Demo Reviewer" } };
    else if (url.pathname.endsWith("/organizations") && route.request().method() === "POST") data = { organization: { id: "created-org", name: JSON.parse(route.request().postData()).name }, role: "owner" };
    else if (url.pathname.endsWith("/organizations")) data = { organizations: [{ id: "test-org", name: "Demo Team", role: "owner" }] };
    else if (url.pathname.includes("/dashboard/organizations/")) data = {
      organization: { id: "test-org", name: "Demo Team" }, repositories: { connected: true, total: 1 },
      totals: { scans: 1, findings: 1, criticalAndHigh: 1 },
      riskDistribution: { critical: 0, high: 1, medium: 0, low: 0 },
      recentScans: [latestScan], priorityFindings: [{ _id: "finding-1", owner: "team", repo: "project", filePath: "src/index.js", startLine: 3, cwe: "CWE-89", scanner: "semgrep", severity: "high", title: "Unsafe query", riskScore: 8.2, riskCategory: "high" }],
      scannerStatus: { semgrep: { status: "completed", scanAt: "2026-10-20T00:00:00Z" } },
    };
    else if (url.pathname.endsWith("/github/organizations/test-org/status")) data = { connected: true, installation: { htmlUrl: "https://github.com/settings/installations/1" } };
    else if (url.pathname.endsWith("/github/organizations/test-org/repositories")) data = { repositories: [{ id: 42, owner: "team", name: "project", fullName: "team/project", defaultBranch: "main", private: true }] };
    else if (url.pathname.endsWith("/github/organizations/test-org/repositories/team/project/files")) data = { files: [{ path: "src/index.js", size: 120, commitSha: "abc123456789" }, { path: "README.md", size: 28, commitSha: "abc123456789" }] };
    else if (url.pathname.endsWith("/github/organizations/test-org/repositories/team/project/file")) data = { path: "src/index.js", content: "const safe = true;\n", encoding: "utf-8" };
    else if (url.pathname.endsWith("/organizations/test-org/repositories/team/project/automation")) {
      if (route.request().method() === "PUT") automationSettings = { ...automationSettings, ...JSON.parse(route.request().postData()) };
      data = { settings: automationSettings, webhookReady: false };
    }
    else if (url.pathname.endsWith("/organizations/invitations/accept") && route.request().method() === "POST") data = { organization: { id: "test-org", name: "Demo Team" } };
    else if (url.pathname.endsWith("/scans/organizations/test-org/repositories/team/project") && route.request().method() === "POST") {
      latestScan = { ...latestScan, _id: "scan-2", status: "queued", commitSha: null };
      data = { scanId: latestScan._id, status: latestScan.status, createdAt: latestScan.createdAt, summary: { total: 0 } };
    }
    else if (url.pathname.endsWith("/scans/organizations/test-org/repositories/team/project")) data = { scans: [latestScan] };
    else if (url.pathname.endsWith(`/scans/${latestScan._id}/comparison`)) data = { new: [], persistent: [], fixed: [], canInferFixed: true, limitation: "Synthetic fixture" };
    else if (url.pathname.endsWith(`/scans/${latestScan._id}/cancel`) && route.request().method() === "POST") { latestScan = { ...latestScan, status: "failed" }; data = latestScan; }
    else if (url.pathname.endsWith(`/scans/${latestScan._id}/findings`)) data = { findings: [{ _id: "finding-1", scan: latestScan._id, organization: "test-org", owner: "team", repo: "project", title: "Unsafe query", severity: "high", riskCategory: "high", riskScore: 8.2, scanner: "semgrep", cwe: "CWE-89", filePath: "src/index.js", startLine: 3, status: "open", description: "Untrusted input reaches a query.", evidenceSnippet: "db.query(input)", remediation: "Use parameterized queries." }], pagination: { page: 1, total: 1, totalPages: 1 } };
    else if (url.pathname.endsWith(`/scans/${latestScan._id}`)) data = latestScan;
    else if (url.pathname.endsWith("/scans/organizations/test-org/findings")) data = { findings: [], latestScans: [], pagination: { page: 1, total: 0, totalPages: 1 } };
    else if (url.pathname.endsWith("/ai-settings")) {
      if (route.request().method() === "PATCH") hostedAiEnabled = JSON.parse(route.request().postData()).hostedAiEnabled;
      data = { hostedAiEnabled };
    }
    else if (url.pathname.endsWith("/members")) data = { members: [{ user: { id: "test-user", name: "Demo Reviewer", email: "test@example.com" }, role: "owner" }] };
    else if (url.pathname.endsWith("/invitations") && route.request().method() === "POST") data = { invitation: { id: "invite-1", email: "new@example.com", role: "developer", status: "pending", expiresAt: "2026-10-27T00:00:00.000Z", url: "http://127.0.0.1:5174/invite/accept?token=fixture-token" } };
    else if (url.pathname.endsWith("/invitations")) data = { invitations: [] };
    else if (url.pathname.endsWith("/ai/health")) data = { status: "configured", languages: ["javascript", "python", "typescript", "c", "cpp", "bash"], execution: "disabled" };
    else if (url.pathname.endsWith("/ai/demo/health")) data = { status: "configured", languages: ["javascript", "python", "typescript", "c", "cpp", "bash"], execution: "disabled", demo: true };
    else if (url.pathname.endsWith("/ai/demo/knowledge")) data = { chunks: 2, sources: ["approved-security-guide.md"] };
    else if (url.pathname.endsWith("/ai/policy")) data = { hostedAiEnabled, provider: "NVIDIA", consentRequired: true };
    else if (url.pathname.endsWith("/ai/knowledge")) data = { chunks: 2, sources: ["approved-security-guide.md"] };
    else if (url.pathname.endsWith("/ai/fixtures")) data = { events: {
      suspicious: { id: "evt-1", timestamp: "2026-10-20T12:00:00Z", category: "authentication", synthetic: true, failed_attempts: 12 },
      benign: { id: "evt-2", timestamp: "2026-10-20T12:00:00Z", category: "service_check", synthetic: true, connections: 2 },
    }, code: {
      javascript: { language: "javascript", mode: "generate", request: "Use safe input handling.", originalCode: "" },
      python: { language: "python", mode: "generate", request: "Validate untrusted values.", originalCode: "" },
      typescript: { language: "typescript", mode: "generate", request: "Write a safe TypeScript validator.", originalCode: "" },
      c: { language: "c", mode: "generate", request: "Write a safe C parser.", originalCode: "" },
      cpp: { language: "cpp", mode: "generate", request: "Write a safe C++ parser.", originalCode: "" },
      bash: { language: "bash", mode: "generate", request: "Validate shell inputs.", originalCode: "" },
      review: { language: "javascript", mode: "review", request: "Review this port parser.", originalCode: "export function validatePort(value) { return parseInt(value, 10); }\n" },
    }, provenance: "Synthetic test fixture" };
    else if (url.pathname.endsWith("/ai/demo/fixtures")) data = { events: {
      suspicious: { id: "evt-1", timestamp: "2026-10-20T12:00:00Z", category: "authentication", synthetic: true, failed_attempts: 12 },
      benign: { id: "evt-2", timestamp: "2026-10-20T12:00:00Z", category: "service_check", synthetic: true, connections: 2 },
    }, code: {
      javascript: { language: "javascript", mode: "generate", request: "Use safe input handling.", originalCode: "" },
      python: { language: "python", mode: "generate", request: "Validate untrusted values.", originalCode: "" },
      typescript: { language: "typescript", mode: "generate", request: "Write a safe TypeScript validator.", originalCode: "" },
      c: { language: "c", mode: "generate", request: "Write a safe C parser.", originalCode: "" },
      cpp: { language: "cpp", mode: "generate", request: "Write a safe C++ parser.", originalCode: "" },
      bash: { language: "bash", mode: "generate", request: "Validate shell inputs.", originalCode: "" },
      review: { language: "javascript", mode: "review", request: "Review this port parser.", originalCode: "export function validatePort(value) { return parseInt(value, 10); }\n" },
    }, provenance: "Synthetic test fixture" };
    else if (url.pathname.endsWith("/ai/analyze") && route.request().method() === "POST") data = { status: "complete", analysis: { summary: "Synthetic evidence reviewed." }, retrieved_sources: [] };
    else if (url.pathname.endsWith("/ai/code") && route.request().method() === "POST") data = { status: "complete", language: "typescript", proposal: { explanation: "Checks the value before use.", code: "export function validatePort(value: unknown): number { throw new Error('implement'); }\n", format: "source", assumptions: [], dependencies: [], security_considerations: [], validation_instructions: [], tests: [] }, validation: { status: "not_executed" }, sources: [] };
    else if (url.pathname.endsWith("/ai/retrieve") && route.request().method() === "POST") data = { sources: [{ id: "source-1", source: "approved-security-guide.md", startLine: 1, endLine: 2, score: 0.9, text: "Use strict validation." }] };
    else if (url.pathname.endsWith("/ai/demo/analyze") && route.request().method() === "POST") data = { status: "complete", analysis: { summary: "Synthetic event reviewed." }, retrieved_sources: [] };
    else if (url.pathname.includes("/findings")) data = { findings: [], latestScans: [], pagination: { page: 1, total: 0, totalPages: 1 } };
    else data = {};
    await route.fulfill({ json: { success: true, data } });
  });
});
test("workspace navigation exposes team settings and current findings", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Workspace settings" })).toBeVisible();
  await expect(page.getByText("Demo Reviewer").first()).toBeVisible();
  await page.getByRole("link", { name: "Findings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Current unresolved findings" })).toBeVisible();
  await expect(page.getByText("No unresolved findings match this view.")).toBeVisible();
});
test("workspace owners can create a shareable invitation link", async ({ page }) => {
  await page.goto("/settings");
  await page.getByLabel("Email address").fill("new@example.com");
  await page.getByRole("button", { name: "Create invite link" }).click();
  await expect(page.getByText("Invite link created. Anyone with this link can use it once before it expires.")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Invitation link" })).toHaveValue(/invite\/accept\?token=fixture-token/);
});
test("workspace owner can disable and re-enable hosted AI", async ({ page }) => {
  await page.goto("/settings");
  const toggle = page.getByRole("checkbox", { name: /Allow hosted AI for this organization/ });
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  await toggle.click();
  await expect(toggle).toBeChecked();
});
test("workspace can create and select an organization", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Create organization" }).click();
  await page.getByLabel("Organization name").fill("College Security Team");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page.getByText("College Security Team · Your role: owner")).toBeVisible();
  await expect(page.getByRole("combobox").first()).toHaveValue("created-org");
});
test("sign-out posts to the session endpoint and returns home", async ({ page }) => {
  await page.goto("/dashboard");
  const logout = page.waitForRequest(request => request.url().endsWith("/api/v1/auth/logout") && request.method() === "POST");
  await page.getByTitle("Sign out").click();
  await logout;
  await expect(page.getByRole("heading", { name: /find the vulnerability/i })).toBeVisible();
});
test("hosted assistant shows a sanitized data preview and requires per-request approval", async ({ page }) => {
  let submittedRequest;
  await page.route("**/api/v1/organizations/test-org/ai/analyze", async route => {
    submittedRequest = route.request();
    await route.fulfill({ json: { success: true, data: { status: "complete", analysis: { summary: "Synthetic evidence reviewed." }, retrieved_sources: [] } } });
  });
  await page.goto("/assistant");
  await expect(page.getByRole("heading", { name: "Evidence before action." })).toBeVisible();
  await expect(page.getByLabel("Sanitized data preview")).toContainText("evt-1");
  const submit = page.getByRole("button", { name: "Analyze evidence" });
  await expect(submit).toBeDisabled();
  await page.getByRole("checkbox", { name: /I approve sending the data shown above/ }).check();
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByText("Synthetic evidence reviewed.")).toBeVisible();
  expect(submittedRequest.headers()["x-securepatch-ai-consent"]).toBe("1");
});
test("unknown routes show a recoverable not-found page", async ({ page }) => {
  await page.goto("/missing-page"); await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Return home" })).toHaveAttribute("href", "/");
});
test("invitation acceptance and missing-token states are recoverable", async ({ page }) => {
  await page.goto("/invite/accept?token=fixture-token");
  await expect(page.getByText("You joined Demo Team.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open workspace" })).toHaveAttribute("href", "/dashboard");
  await page.goto("/invite/accept");
  await expect(page.getByRole("alert")).toHaveText("This invitation link is missing its token.");
});
test("all application routes render their intended page", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  const routes = [
    ["/", /Find the vulnerability/],
    ["/login", /Secure your codebase/],
    ["/invite/accept?token=fixture-token", /Join a SecurePatch workspace/],
    ["/dashboard", /Demo Team/],
    ["/github", /^GitHub$/],
    ["/github/team/project", /^project$/],
    ["/github/team/project/scan", /Security scans/],
    ["/github/team/project/file?path=src%2Findex.js", /src\/index\.js/],
    ["/findings", /Current unresolved findings/],
    ["/settings", /Workspace settings/],
    ["/assistant", /Evidence before action/],
    ["/assistant-demo", /Evidence before action/],
  ];
  for (const [path, heading] of routes) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading }).first(), `route ${path}`).toBeVisible();
  }
  expect(pageErrors).toEqual([]);
});
test("mobile navigation leads to sign-in", async ({ page }) => {
  await page.route("**/api/v1/auth/me", route => route.fulfill({ status: 401, json: { success: false } }));
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/");
  await page.getByRole("button", { name: "Toggle navigation menu" }).click();
  await page.getByRole("link", { name: "Sign in", exact: true }).last().click();
  await expect(page.getByRole("button", { name: /continue with github/i })).toBeVisible();
});

test("scan history follows the polled status and pinned commit", async ({ page }) => {
  const scan = { _id: "scan-1", owner: "team", repo: "project", organization: "test-org", createdAt: "2026-10-20T00:00:00Z", commitSha: "abc123456789", status: "completed", summary: { total: 0 } };
  await page.route("**/api/v1/scans/**", route => {
    const path = new URL(route.request().url()).pathname;
    const data = path.endsWith("/findings")
      ? { findings: [], pagination: { total: 0, totalPages: 1 } }
      : path.includes("/repositories/") ? { scans: [{ ...scan, status: "queued", commitSha: null }] } : scan;
    return route.fulfill({ json: { success: true, data } });
  });
  await page.goto("/github/team/project/scan");
  await expect(page.getByRole("heading", { name: "Security scans" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Scan history" }).getByRole("option", { selected: true })).toHaveText(/completed · abc1234/);
});

test("hero scanning CTA and final CTA both lead to working authentication actions", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/");

  await page.locator("#product").getByRole("link", { name: "Start scanning" }).click();
  await expect(page.getByRole("heading", { name: "Secure your codebase." })).toBeVisible();
  const githubAuth = page.waitForRequest(request => request.url().includes("/api/v1/auth/github"));
  await page.getByRole("button", { name: /continue with github/i }).click();
  await githubAuth;
  await page.goto("/login?returnTo=%2Fassistant");
  const googleAuth = page.waitForRequest(request => request.url().includes("/api/v1/auth/google"));
  await page.getByRole("button", { name: /continue with google/i }).click();
  expect(new URL((await googleAuth).url()).searchParams.get("returnTo")).toBe("/assistant");

  await page.goto("/");
  await page.getByRole("button", { name: "Start scanning" }).click();
  const dialog = page.getByRole("dialog", { name: "Scan your GitHub repository" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Open repositories" })).toHaveAttribute("href", "/github");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  expect(pageErrors).toEqual([]);
});

test("dashboard links through repository tree to a pinned source file and scan history", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Demo Team" })).toBeVisible();
  await expect(page.getByText("Critical + high risk")).toBeVisible();
  await page.getByRole("button", { name: "Refresh" }).click();

  await page.getByRole("link", { name: "Repositories", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Repositories" })).toBeVisible();
  await page.getByRole("button", { name: /team\/project/ }).click();
  await expect(page.getByRole("heading", { name: "project" })).toBeVisible();

  await page.getByText("Repository automation").click();
  await page.getByLabel("Schedule").selectOption("weekly");
  await page.getByRole("button", { name: "Save automation" }).click();
  await expect(page.getByLabel("Schedule")).toHaveValue("weekly");
  await page.reload();
  await page.getByText("Repository automation").click();
  await expect(page.getByLabel("Schedule")).toHaveValue("weekly");

  await page.getByRole("button", { name: "src" }).click();
  await page.getByRole("button", { name: /index\.js/ }).click();
  await expect(page.getByRole("heading", { name: "src/index.js" })).toBeVisible();
  await expect(page.getByText("const safe = true;")).toBeVisible();
  await page.getByRole("button", { name: "Back to repository" }).click();
  await page.getByRole("button", { name: "Scan Repository" }).click();
  await expect(page.getByRole("heading", { name: "Security scans" })).toBeVisible();
  await expect(page.getByText("Commit abc123456789")).toBeVisible();
  await page.getByRole("button", { name: "Compare with previous scan" }).click();
  await expect(page.getByRole("heading", { name: "Changes since the previous successful scan" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Export JSON" })).toHaveAttribute("href", "/api/v1/scans/scan-1/export?format=json");
  expect(pageErrors).toEqual([]);
});

test("file viewer reports copy success and a manual-selection fallback", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: async text => { window.__copiedFile = text; } },
  }));
  await page.goto("/github/team/project/file?path=src%2Findex.js");
  await page.getByRole("button", { name: "Copy file to clipboard" }).click();
  await expect(page.getByRole("button", { name: "File copied to clipboard" })).toBeVisible();
  expect(await page.evaluate(() => window.__copiedFile)).toBe("const safe = true;\n");

  await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: async () => { throw new Error("permission denied"); } },
  }));
  await page.reload();
  await page.getByRole("button", { name: "Copy file to clipboard" }).click();
  await expect(page.getByRole("alert")).toContainText("Select the file contents to copy them manually.");
});

test("a member can start and cancel a scan with dependency checks disclosed", async ({ page }) => {
  let submittedBody;
  let cancelled = false;
  await page.route("**/api/v1/scans/organizations/test-org/repositories/team/project", async route => {
    if (route.request().method() === "POST") {
      submittedBody = JSON.parse(route.request().postData());
      await route.fulfill({ json: { success: true, data: { scanId: "scan-2", status: "queued", createdAt: "2026-10-20T00:00:00Z", summary: { total: 0 } } } });
    } else {
      await route.fulfill({ json: { success: true, data: { scans: [{ _id: "scan-1", owner: "team", repo: "project", organization: "test-org", createdAt: "2026-10-20T00:00:00Z", commitSha: "abc123456789", status: "completed", summary: { total: 1 } }] } } });
    }
  });
  await page.route("**/api/v1/scans/scan-2/cancel", async route => {
    cancelled = true;
    await route.fulfill({ json: { success: true, data: { _id: "scan-2", owner: "team", repo: "project", organization: "test-org", status: "failed", summary: { total: 0 } } } });
  });
  await page.route("**/api/v1/scans/scan-2", route => route.fulfill({ json: { success: true, data: { _id: "scan-2", owner: "team", repo: "project", organization: "test-org", status: cancelled ? "failed" : "queued", summary: { total: 0 } } } }));
  await page.route("**/api/v1/scans/scan-2/findings**", route => route.fulfill({ json: { success: true, data: { findings: [], pagination: { page: 1, total: 0, totalPages: 1 } } } }));
  await page.goto("/github/team/project/scan");
  const dependencyConsent = page.getByRole("checkbox", { name: /Include dependency advisories/ });
  await dependencyConsent.check();
  await page.getByRole("button", { name: "New scan" }).click();
  await expect(page.getByRole("button", { name: "Cancel scan" })).toBeVisible();
  expect(submittedBody.includeDependencies).toBe(true);
  await page.getByRole("button", { name: "Cancel scan" }).click();
  await expect(page.getByText("FAILED", { exact: true })).toBeVisible();
});

test("finding filters use server pagination and review changes are submitted", async ({ page }) => {
  const finding = { _id: "finding-1", scan: "scan-1", organization: "test-org", owner: "team", repo: "project", title: "Unsafe query", severity: "high", riskCategory: "high", riskScore: 8.2, scanner: "semgrep", cwe: "CWE-89", filePath: "src/index.js", startLine: 3, status: "open", description: "Untrusted input reaches a query.", evidenceSnippet: "db.query(input)", remediation: "Use parameterized queries." };
  const requestedUrls = [];
  let savedReview;
  await page.route("**/api/v1/scans/organizations/test-org/findings**", async route => {
    requestedUrls.push(route.request().url());
    const pageNumber = new URL(route.request().url()).searchParams.get("page");
    await route.fulfill({ json: { success: true, data: { findings: pageNumber === "1" ? [finding] : [], latestScans: [{ scan: "scan-1", commitSha: "abc123456789" }], pagination: { page: Number(pageNumber), total: 30, totalPages: 2 } } } });
  });
  await page.route("**/api/v1/scans/scan-1/findings/finding-1", async route => {
    savedReview = JSON.parse(route.request().postData());
    await route.fulfill({ json: { success: true, data: { ...finding, ...savedReview } } });
  });
  await page.goto("/findings");
  await expect(page.getByRole("heading", { name: "Unsafe query" })).toBeVisible();
  await page.getByLabel("Risk filter").selectOption("high");
  await expect.poll(() => requestedUrls.some(url => new URL(url).searchParams.get("riskCategory") === "high")).toBe(true);
  await page.getByRole("button", { name: "Expand finding", exact: true }).click();
  await page.getByLabel("Review status").selectOption("acknowledged");
  await page.getByLabel("Reason").fill("Confirmed, tracking in sprint.");
  await page.getByRole("button", { name: "Save review" }).click();
  await expect.poll(() => savedReview?.status).toBe("acknowledged");
  expect(savedReview.reason).toBe("Confirmed, tracking in sprint.");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("2/2 · 30 findings")).toBeVisible();
  await expect.poll(() => requestedUrls.some(url => new URL(url).searchParams.get("page") === "2")).toBe(true);
});

test("GitHub installation can be connected and repository access modal can be closed", async ({ page }) => {
  let connected = false;
  await page.route("**/api/v1/github/organizations/test-org/status", async route => {
    await route.fulfill({ json: { success: true, data: { connected, installation: connected ? { htmlUrl: "https://github.com/settings/installations/10" } : null } } });
  });
  await page.route("**/api/v1/github/installations", route => route.fulfill({ json: { success: true, data: [{ id: 10, account: "team" }] } }));
  await page.route("**/api/v1/github/test", route => route.fulfill({ json: { success: true, data: { slug: "avpr-net" } } }));
  await page.route("**/api/v1/github/organizations/test-org/connect", async route => {
    connected = true;
    await route.fulfill({ json: { success: true, data: { connected: true } } });
  });
  await page.goto("/github");
  await expect(page.getByRole("heading", { name: "Connect your GitHub account" })).toBeVisible();
  await page.getByLabel("GitHub installation").selectOption("10");
  await page.getByRole("button", { name: "Connect installation" }).click();
  await expect(page.getByText("Connected", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /team\/project/ })).toBeVisible();
  await page.getByRole("button", { name: "Add repository" }).click();
  const modal = page.getByRole("heading", { name: "Add repository" });
  await expect(modal).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(modal).toBeHidden();
});

test("landing workflow, playground tabs and stage controls respond to clicks", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "How it works", exact: true }).click();
  await expect(page).toHaveURL(/#workflow$/);
  await page.getByRole("button", { name: "02 PRIORITIZE" }).click();
  await expect(page.getByText("Not every vulnerability deserves the same urgency.")).toBeVisible();
  await page.getByRole("button", { name: /Next: REMEDIATE/ }).click();
  await expect(page.getByText("From finding to fix.")).toBeVisible();

  await page.getByRole("button", { name: "Risk Scoring" }).click();
  await expect(page.getByText("TOTAL RISK")).toBeVisible();
  await page.getByRole("button", { name: "Source Code" }).click();
  await expect(page.getByText("Showing contextual window around Line 124")).toBeVisible();
  await page.getByRole("button", { name: "Verification" }).click();
  await expect(page.getByText(/Independent compatibility review required|Run independent tests/)).toBeVisible();
});

test("assistant rejects malformed finding IDs and consumes approval after one request", async ({ page }) => {
  let analyses = 0;
  await page.route("**/api/v1/organizations/test-org/ai/analyze", async route => {
    analyses += 1;
    await route.fulfill({ json: { success: true, data: { status: "complete", analysis: { summary: "Synthetic evidence reviewed." }, retrieved_sources: [] } } });
  });
  await page.goto("/assistant");
  const submit = page.getByRole("button", { name: "Analyze evidence" });
  const consent = page.getByRole("checkbox", { name: /I approve sending the data shown above/ });
  await page.getByLabel("Finding ID").fill("not-a-finding-id");
  await expect(page.getByRole("alert")).toContainText("exactly 24 hexadecimal characters");
  await expect(page.getByText("Loading sanitized finding preview…")).toHaveCount(0);
  await expect(consent).toBeDisabled();
  await expect(submit).toBeDisabled();

  await page.getByLabel("Finding ID").fill("");
  await consent.check();
  await submit.click();
  await expect(page.getByText("Synthetic evidence reviewed.")).toBeVisible();
  await expect(consent).not.toBeChecked();
  await expect(submit).toBeDisabled();
  expect(analyses).toBe(1);
});

test("assistant language selection and knowledge search submit the reviewed payload", async ({ page }) => {
  let submittedCode;
  let submittedQuery;
  await page.route("**/api/v1/organizations/test-org/ai/code", async route => {
    submittedCode = route.request();
    await route.fulfill({ json: { success: true, data: { status: "complete", language: "typescript", proposal: { explanation: "Checks the value before use.", code: "export function validatePort(value: unknown): number { throw new Error('implement'); }\n", format: "source", assumptions: [], dependencies: [], security_considerations: [], validation_instructions: [], tests: [] }, validation: { status: "not_executed" }, sources: [] } } });
  });
  await page.route("**/api/v1/organizations/test-org/ai/retrieve", async route => {
    submittedQuery = route.request();
    await route.fulfill({ json: { success: true, data: { sources: [{ id: "source-1", source: "approved-security-guide.md", startLine: 1, endLine: 2, score: 0.9, text: "Use strict validation." }] } } });
  });
  await page.goto("/assistant");
  await page.getByRole("button", { name: "Code & review" }).click();
  await page.getByRole("button", { name: "Load review example" }).click();
  await expect(page.getByLabel("Mode")).toHaveValue("review");
  await expect(page.getByLabel("Source for review")).toHaveValue(/parseInt\(value, 10\)/);
  const language = page.getByLabel("Language");
  await language.selectOption("typescript");
  await expect(language).toHaveValue("typescript");
  await expect(page.getByLabel("Code request")).toHaveValue("Write a safe TypeScript validator.");
  const consent = page.getByRole("checkbox", { name: /I approve sending the data shown above/ });
  await consent.check();
  await page.getByRole("button", { name: "Draft proposal" }).click();
  await expect(page.getByText("Checks the value before use.")).toBeVisible();
  expect(JSON.parse(submittedCode.postData()).language).toBe("typescript");
  expect(submittedCode.headers()["x-securepatch-ai-consent"]).toBe("1");
  await expect(consent).not.toBeChecked();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download proposal" }).click();
  expect((await download).suggestedFilename()).toBe("securepatch-proposal.txt");

  await page.getByRole("button", { name: "Knowledge" }).click();
  await page.getByLabel("Knowledge query").fill("strict request validation");
  await consent.check();
  await page.getByRole("button", { name: "Retrieve sources" }).click();
  await expect(page.getByText("approved-security-guide.md:1–2")).toBeVisible();
  expect(JSON.parse(submittedQuery.postData()).query).toBe("strict request validation");
});

test("local synthetic assistant demo requires approval and labels demo requests", async ({ page }) => {
  let submittedRequest;
  await page.route("**/api/v1/ai/demo/analyze", async route => {
    submittedRequest = route.request();
    await route.fulfill({ json: { success: true, data: { status: "complete", analysis: { summary: "Synthetic event reviewed." }, retrieved_sources: [] } } });
  });
  await page.goto("/assistant-demo");
  await expect(page.getByText("LOCAL SYNTHETIC DEMO")).toBeVisible();
  await page.getByRole("button", { name: "benign fixture" }).click();
  await expect(page.getByLabel("Sanitized data preview")).toContainText("service_check");
  const consent = page.getByRole("checkbox", { name: /I approve sending the data shown above/ });
  const submit = page.getByRole("button", { name: "Analyze evidence" });
  await expect(submit).toBeDisabled();
  await consent.check();
  await submit.click();
  await expect(page.getByText("Synthetic event reviewed.")).toBeVisible();
  expect(submittedRequest.headers()["x-securepatch-demo"]).toBe("1");
  expect(submittedRequest.headers()["x-securepatch-ai-consent"]).toBe("1");
});

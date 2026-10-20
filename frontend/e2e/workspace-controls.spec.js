import { expect, test } from "@playwright/test";

const orgs = [
  { id: "org-a", name: "Demo Team", role: "owner" },
  { id: "org-b", name: "Second Team", role: "owner" },
];

const finding = (id = "finding-1", status = "open") => ({
  _id: id,
  scan: "scan-1",
  organization: "org-a",
  owner: "team",
  repo: "project",
  title: id === "finding-1" ? "Unsafe query" : "Unvalidated redirect",
  severity: "high",
  riskCategory: "high",
  riskScore: 8.2,
  scanner: "semgrep",
  cwe: "CWE-89",
  filePath: "src/index.js",
  startLine: 3,
  status,
  description: "Untrusted input reaches a query.",
  evidenceSnippet: "db.query(input)",
  remediation: "Use parameterized queries.",
});

function installWorkspaceApi(page, overrides = {}) {
  const state = {
    organizations: structuredClone(orgs),
    members: [
      { user: { id: "test-user", name: "Demo Reviewer", email: "test@example.com" }, role: "owner" },
      { user: { id: "member-1", name: "Teammate", email: "teammate@example.com" }, role: "developer" },
    ],
    invitations: [{ id: "invite-1", email: "pending@example.com", role: "developer", status: "pending", expiresAt: "2026-10-27T00:00:00.000Z" }],
    hostedAiEnabled: true,
    connected: true,
    installations: [{ id: 10, account: "team" }, { id: 11, account: "team-labs" }],
    repositories: [{ id: 42, owner: "team", name: "project", fullName: "team/project", defaultBranch: "main", private: true }],
    files: [
      { path: "src/components/Button.jsx", size: 120, commitSha: "abc123456789" },
      { path: "src/index.js", size: 40, commitSha: "abc123456789" },
      { path: "README.md", size: 28, commitSha: "abc123456789" },
    ],
    file: { path: "src/index.js", content: "const safe = true;\n", encoding: "utf-8" },
    automation: { settings: { push: false, pullRequest: false, frequency: "off" }, webhookReady: true },
    scans: [
      { _id: "scan-1", owner: "team", repo: "project", organization: "org-a", createdAt: "2026-10-20T00:00:00.000Z", commitSha: "abc123456789", status: "completed", summary: { total: 2 }, coverage: { semgrep: "complete" }, rulesHash: "rules-1" },
      { _id: "scan-0", owner: "team", repo: "project", organization: "org-a", createdAt: "2026-10-19T00:00:00.000Z", commitSha: "def987654321", status: "completed", summary: { total: 1 }, coverage: { semgrep: "complete" }, rulesHash: "rules-0" },
    ],
    failNext: {},
    calls: [],
    ...overrides,
  };

  page.route("**/api/v1/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname, searchParams } = url;
    const method = request.method();
    const call = { method, pathname, search: url.search, body: request.postDataJSON?.() };
    state.calls.push(call);
    let data = {};
    let status = 200;

    const failOnce = key => {
      const failure = state.failNext[key];
      if (!failure) return false;
      let message;
      if (typeof failure === "object") {
        if (failure.remaining <= 0) return false;
        message = failure.message || `${key} fixture failure`;
        failure.remaining -= 1;
      } else {
        message = failure === true ? `${key} fixture failure` : failure;
        state.failNext[key] = false;
      }
      status = 503;
      data = { error: { message } };
      return true;
    };

    if (pathname.endsWith("/auth/me")) data = { user: { id: "test-user", name: "Demo Reviewer", email: "test@example.com" } };
    else if (pathname.endsWith("/auth/logout") && method === "POST") {
      if (!failOnce("logout")) data = {};
    } else if (pathname.endsWith("/organizations") && method === "GET") {
      if (!failOnce("organizations")) data = { organizations: state.organizations };
    }
    else if (pathname.endsWith("/organizations") && method === "POST") {
      if (!failOnce("createOrganization")) {
        const organization = { id: `org-${state.organizations.length + 1}`, name: JSON.parse(request.postData()).name };
        state.organizations.push({ ...organization, role: "owner" });
        data = { organization, role: "owner" };
      }
    } else if (pathname.includes("/dashboard/organizations/")) {
      if (!failOnce("dashboard")) {
        const name = state.organizations.find(org => org.id === pathname.split("/").at(-1))?.name || "Demo Team";
        data = {
          organization: { id: pathname.split("/").at(-1), name }, repositories: { connected: true, total: 1 },
          totals: { scans: 2, findings: 2, criticalAndHigh: 1 }, riskDistribution: { critical: 0, high: 1, medium: 1, low: 0 },
          recentScans: [state.scans[0]], priorityFindings: [finding()], scannerStatus: { semgrep: { status: "completed", scanAt: "2026-10-20T00:00:00.000Z" } },
        };
      }
    } else if (/\/github\/organizations\/[^/]+\/status$/.test(pathname)) {
      if (!failOnce("githubStatus")) data = { connected: state.connected, installation: state.connected ? { htmlUrl: "https://github.com/settings/installations/10" } : null };
    } else if (/\/github\/organizations\/[^/]+\/repositories$/.test(pathname)) {
      if (!failOnce("repositories")) data = { repositories: state.repositories };
    } else if (pathname.endsWith("/github/installations")) data = state.installations;
    else if (pathname.endsWith("/github/test")) data = { slug: "avpr-net" };
    else if (/\/github\/organizations\/[^/]+\/connect$/.test(pathname) && method === "POST") {
      if (!failOnce("connect")) { state.connected = true; data = { connected: true }; }
    } else if (pathname.endsWith("/repositories/team/project/files")) {
      if (!failOnce("files")) data = { files: state.files };
    } else if (pathname.endsWith("/repositories/team/project/file")) {
      if (!failOnce("file")) data = state.file;
    } else if (pathname.endsWith("/organizations/org-a/repositories/team/project/automation")) {
      if (method === "PUT") {
        if (!failOnce("automationSave")) state.automation.settings = JSON.parse(request.postData());
      }
      if (status < 400) data = { settings: state.automation.settings, webhookReady: state.automation.webhookReady };
    } else if (pathname.endsWith("/organizations/org-a/members") && method === "GET") {
      if (!failOnce("members")) data = { members: state.members };
    } else if (pathname.match(/\/organizations\/org-a\/members\/member-1\/role$/) && method === "PATCH") {
      if (!failOnce("memberRole")) {
        const role = JSON.parse(request.postData()).role;
        state.members = state.members.map(member => member.user.id === "member-1" ? { ...member, role } : member);
        data = { member: state.members.find(member => member.user.id === "member-1") };
      }
    } else if (pathname.endsWith("/organizations/org-a/members/member-1") && method === "DELETE") {
      if (!failOnce("memberRevoke")) { state.members = state.members.filter(member => member.user.id !== "member-1"); data = {}; }
    } else if (pathname.endsWith("/organizations/org-a/invitations") && method === "GET") {
      if (!failOnce("invitations")) data = { invitations: state.invitations };
    } else if (pathname.endsWith("/organizations/org-a/invitations") && method === "POST") {
      if (!failOnce("inviteCreate")) {
        const input = JSON.parse(request.postData());
        const invitation = { id: "invite-new", ...input, status: "pending", expiresAt: "2026-10-27T00:00:00.000Z", url: "http://127.0.0.1:5174/invite/accept?token=fixture-token" };
        state.invitations.push(invitation); data = { invitation };
      }
    } else if (pathname.endsWith("/organizations/org-a/invitations/invite-1") && method === "DELETE") {
      if (!failOnce("inviteRevoke")) { state.invitations = state.invitations.filter(invite => invite.id !== "invite-1"); data = {}; }
    } else if (pathname.endsWith("/organizations/org-a/ai-settings")) {
      if (method === "PATCH") {
        if (!failOnce("aiSettings")) state.hostedAiEnabled = JSON.parse(request.postData()).hostedAiEnabled;
      }
      if (status < 400) data = { hostedAiEnabled: state.hostedAiEnabled };
    } else if (pathname.endsWith("/scans/organizations/org-a/repositories/team/project") && method === "GET") {
      if (!failOnce("scanHistory")) data = { scans: state.scans };
    } else if (pathname.endsWith("/scans/organizations/org-a/repositories/team/project") && method === "POST") {
      if (!failOnce("scanStart")) {
        const scan = { _id: "scan-2", owner: "team", repo: "project", organization: "org-a", createdAt: "2026-10-20T01:00:00.000Z", commitSha: null, status: "queued", summary: { total: 0 } };
        state.scans.unshift(scan); data = { scanId: scan._id, status: scan.status, createdAt: scan.createdAt, summary: scan.summary };
      }
    } else if (pathname.endsWith("/scans/scan-2/cancel") && method === "POST") {
      if (!failOnce("scanCancel")) { state.scans[0].status = "failed"; data = state.scans[0]; }
    } else if (/\/scans\/[^/]+\/cancel$/.test(pathname) && method === "POST") {
      if (!failOnce("scanCancel")) { const scan = state.scans.find(item => item._id === pathname.split("/").at(-2)); if (scan) scan.status = "failed"; data = scan || {}; }
    } else if (/\/scans\/[^/]+\/comparison$/.test(pathname)) {
      if (!failOnce("comparison")) data = { new: [finding("finding-new")], persistent: [finding()], fixed: [], canInferFixed: true, limitation: "Same scanner coverage." };
    } else if (/\/scans\/[^/]+\/export$/.test(pathname)) {
      if (state.failNext.export) {
        failOnce("export");
        await route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ success: false, ...data }) });
        return;
      }
      const format = searchParams.get("format") || "json";
      await route.fulfill({ status: 200, contentType: format === "sarif" ? "application/sarif+json" : "application/json", headers: { "content-disposition": `attachment; filename=scan.${format}` }, body: format === "sarif" ? JSON.stringify({ version: "2.1.0", runs: [] }) : JSON.stringify({ scans: state.scans }) });
      return;
    } else if (/\/scans\/[^/]+\/findings\/[^/]+$/.test(pathname) && method === "PATCH") {
      if (!failOnce("review")) data = { ...finding(pathname.split("/").at(-1)), ...JSON.parse(request.postData()) };
    } else if (/\/scans\/[^/]+\/findings$/.test(pathname)) {
      if (!failOnce("scanFindings")) {
        const pageNumber = Number(searchParams.get("page") || 1);
        const items = pageNumber === 1 ? [finding()] : [finding("finding-2")];
        data = { findings: items, pagination: { page: pageNumber, total: 30, totalPages: 2 } };
      }
    } else if (pathname.endsWith("/scans/organizations/org-a/findings")) {
      if (!failOnce("findings")) {
        const pageNumber = Number(searchParams.get("page") || 1);
        const items = pageNumber === 1 ? [finding()] : [finding("finding-2")];
        data = { findings: items, latestScans: [{ scan: "scan-1", commitSha: "abc123456789" }], pagination: { page: pageNumber, total: 30, totalPages: 2 } };
      }
    } else if (/\/scans\/[^/]+$/.test(pathname)) {
      if (!failOnce("scanStatus")) data = state.scans.find(scan => scan._id === pathname.split("/").at(-1)) || state.scans[0];
    } else if (pathname.endsWith("/organizations/invitations/accept") && method === "POST") data = { organization: { id: "org-a", name: "Demo Team" } };

    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(status >= 400 ? { success: false, ...data } : { success: true, data }) });
  });
  return state;
}

test.describe("workspace controls, with mocked APIs", () => {
  test("dashboard refresh, workspace selector, organization form, retry, and mobile navigation", async ({ page }) => {
    const state = installWorkspaceApi(page, { failNext: { dashboard: "Dashboard temporarily unavailable", createOrganization: "Organization create failed" } });
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Demo Team" })).toBeVisible();

    const orgSelector = page.getByRole("combobox").first();
    await orgSelector.selectOption("org-b");
    await expect(page.getByRole("heading", { name: "Second Team" })).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem("securepatch-org:test-user"))).toBe("org-b");

    await page.getByRole("button", { name: "Create organization" }).click();
    await expect(page.getByRole("button", { name: "Create workspace" })).toBeDisabled();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByLabel("Organization name")).toHaveCount(0);
    await page.getByRole("button", { name: "Create organization" }).click();
    await page.getByLabel("Organization name").fill("New Product Team");
    await page.getByRole("button", { name: "Create workspace" }).click();
    await expect(page.getByRole("alert")).toHaveText("Organization create failed");
    await page.getByRole("button", { name: "Create workspace" }).click();
    await expect(page.getByRole("heading", { name: "New Product Team" })).toBeVisible();
    expect(state.calls.filter(call => call.method === "POST" && call.pathname.endsWith("/organizations")).map(call => call.body.name)).toEqual(["New Product Team", "New Product Team"]);

    state.failNext.dashboard = "Dashboard temporarily unavailable";
    await page.getByRole("button", { name: "Refresh" }).click();
    await expect(page.getByRole("heading", { name: "Unable to load the security overview" })).toBeVisible();
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByRole("heading", { name: "New Product Team" })).toBeVisible();
    expect(state.calls.some(call => call.pathname.endsWith("/dashboard/organizations/org-b"))).toBe(true);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Toggle navigation" }).click();
    await expect(page.getByRole("button", { name: "Close navigation" })).toBeVisible();
    await page.getByRole("button", { name: "Close navigation" }).click({ position: { x: 350, y: 120 } });
    await expect(page.getByRole("button", { name: "Close navigation" })).toHaveCount(0);
    await page.getByRole("button", { name: "Toggle navigation" }).click();
    await page.getByRole("navigation").getByRole("link", { name: "Repositories" }).click();
    await expect(page.getByRole("heading", { name: "Repositories" })).toBeVisible();
  });

  test("settings controls change member access, create and revoke invitations, copy links, and update AI privacy", async ({ page }) => {
    const state = installWorkspaceApi(page, { failNext: { inviteCreate: "Invitation service unavailable", memberRole: "Role update failed", inviteRevoke: "Revoke failed", aiSettings: "AI setting update failed" } });
    await page.addInitScript(() => {
      window.__clipboardText = "";
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async text => { window.__clipboardText = text; } } });
    });
    await page.goto("/settings");

    const memberRole = page.locator("section").filter({ hasText: "Team members" }).getByRole("combobox", { name: "Role" });
    await memberRole.selectOption("admin");
    await expect(page.getByRole("alert")).toHaveText("Role update failed");
    await memberRole.selectOption("admin");
    await expect.poll(() => state.members.find(member => member.user.id === "member-1")?.role).toBe("admin");
    await page.getByRole("button", { name: "Revoke access" }).click();
    await expect.poll(() => state.members.some(member => member.user.id === "member-1")).toBe(false);
    await expect(page.locator("section").filter({ has: page.getByRole("heading", { name: "Team members" }) }).getByRole("button", { name: "Revoke access" })).toHaveCount(0);

    await page.getByLabel("Email address").fill("new@example.com");
    await page.locator("form").getByLabel("Role").selectOption("admin");
    await page.getByRole("button", { name: "Create invite link" }).click();
    await expect(page.getByRole("alert")).toHaveText("Invitation service unavailable");
    await page.getByRole("button", { name: "Create invite link" }).click();
    const inviteInput = page.getByRole("textbox", { name: "Invitation link" });
    await expect(inviteInput).toHaveValue(/invite\/accept\?token=fixture-token/);
    expect(state.invitations.at(-1)).toMatchObject({ email: "new@example.com", role: "admin" });
    await page.getByRole("button", { name: "Copy link" }).click();
    expect(await page.evaluate(() => window.__clipboardText)).toMatch(/fixture-token/);

    await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("clipboard denied"); } } }));
    await page.getByRole("button", { name: "Copy link" }).click();
    await expect(page.getByRole("alert")).toHaveText("Copy was unavailable; select and copy the invitation link.");
    const pendingInvitation = page.getByText("pending@example.com · developer", { exact: true }).locator("xpath=../..");
    await pendingInvitation.getByRole("button", { name: "Revoke", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText("Revoke failed");
    await pendingInvitation.getByRole("button", { name: "Revoke", exact: true }).click();
    await expect(page.getByText("pending@example.com · developer")).toHaveCount(0);

    const hostedAi = page.getByRole("checkbox", { name: /Allow hosted AI for this organization/ });
    await expect(hostedAi).toBeChecked();
    await hostedAi.click();
    await expect(page.getByRole("alert")).toHaveText("AI setting update failed");
    await expect(hostedAi).toBeChecked();
    await hostedAi.click();
    await expect(hostedAi).not.toBeChecked();
    expect(state.hostedAiEnabled).toBe(false);
  });

  test("GitHub install selection, connect errors, refresh, repository cards, and modal controls", async ({ page }) => {
    const state = installWorkspaceApi(page, { connected: false, failNext: { connect: "Installation could not be connected" } });
    await page.goto("/github");
    await expect(page.getByRole("heading", { name: "Connect your GitHub account" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in with GitHub" })).toHaveAttribute("href", "/api/v1/auth/github");
    await expect(page.getByRole("link", { name: "Install GitHub App" })).toHaveAttribute("href", "https://github.com/apps/avpr-net/installations/new");
    await page.getByLabel("GitHub installation").selectOption("11");
    await page.getByRole("button", { name: "Connect installation" }).click();
    await expect(page.getByText("Installation could not be connected")).toBeVisible();
    await page.getByRole("button", { name: "Connect installation" }).click();
    await expect(page.getByRole("heading", { name: "Repositories" })).toBeVisible();
    expect(state.connected).toBe(true);

    await page.getByRole("button", { name: "Refresh" }).click();
    await expect.poll(() => state.calls.filter(call => call.pathname.endsWith("/github/organizations/org-a/status")).length).toBeGreaterThan(2);
    await page.getByRole("button", { name: "team/project" }).click();
    await expect(page.getByRole("heading", { name: "project" })).toBeVisible();
    await page.goto("/github");

    await page.getByRole("button", { name: "Add repository" }).click();
    let dialog = page.getByRole("heading", { name: "Add repository" });
    await expect(dialog).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: "Add repository" }).click();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: "Add repository" }).click();
    const manageAccess = page.getByRole("link", { name: "Manage GitHub Access" });
    await expect(manageAccess).toHaveAttribute("href", "https://github.com/settings/installations/10");
    await expect(manageAccess).toHaveAttribute("target", "_blank");
    await page.context().route("https://github.com/settings/installations/10", route => route.fulfill({
      status: 200, contentType: "text/html", body: "<title>GitHub installation settings fixture</title>",
    }));
    const settingsPagePromise = page.context().waitForEvent("page");
    await manageAccess.click();
    const settingsPage = await settingsPagePromise;
    await expect(settingsPage).toHaveURL("https://github.com/settings/installations/10");
    await expect(settingsPage).toHaveTitle("GitHub installation settings fixture");
    await settingsPage.close();
    await expect(dialog).toBeVisible();
    await page.locator("div.fixed.inset-0").filter({ has: dialog }).click({ position: { x: 4, y: 4 } });
    await expect(dialog).toBeHidden();
  });

  test("repository refresh, folder tree, file copy, automation edits, and scan navigation", async ({ page }) => {
    const state = installWorkspaceApi(page, { failNext: { automationSave: "Automation save failed" } });
    await page.addInitScript(() => {
      window.__clipboardText = "";
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async text => { window.__clipboardText = text; } } });
    });
    await page.goto("/github/team/project");
    await expect(page.getByRole("heading", { name: "project" })).toBeVisible();
    const automation = page.getByText("Repository automation");
    await automation.click();
    const push = page.getByRole("checkbox", { name: "Scan default-branch pushes" });
    const pullRequest = page.getByRole("checkbox", { name: "Scan opened/updated pull requests" });
    await push.check(); await pullRequest.check();
    await page.getByLabel("Schedule").selectOption("monthly");
    await page.getByRole("button", { name: "Save automation" }).click();
    await expect(page.getByRole("alert")).toHaveText("Automation save failed");
    await page.getByRole("button", { name: "Save automation" }).click();
    expect(state.automation.settings).toEqual({ push: true, pullRequest: true, frequency: "monthly" });

    await page.getByRole("button", { name: "Refresh" }).click();
    await expect.poll(() => state.calls.filter(call => call.pathname.endsWith("/repositories/team/project/files")).length).toBeGreaterThan(1);
    const src = page.getByRole("button", { name: "src" });
    await src.click();
    await expect(page.getByRole("button", { name: "components" })).toBeVisible();
    await page.getByRole("button", { name: "components" }).click();
    await expect(page.getByRole("button", { name: "Button.jsx" })).toBeVisible();
    await page.getByRole("button", { name: "components" }).click();
    await expect(page.getByRole("button", { name: "Button.jsx" })).toHaveCount(0);
    await page.getByRole("button", { name: "src" }).click();
    await page.getByRole("button", { name: "src" }).click();
    await page.getByRole("button", { name: "index.js" }).click();
    await expect(page).toHaveURL(/\/github\/team\/project\/file\?path=src%2Findex\.js&ref=abc123456789$/);
    await expect(page.getByText("const safe = true;")).toBeVisible();
    await page.getByRole("button", { name: "Copy file to clipboard" }).click();
    expect(await page.evaluate(() => window.__clipboardText)).toBe("const safe = true;\n");
    await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("clipboard denied"); } } }));
    await page.getByRole("button", { name: /File copied to clipboard|Copy file to clipboard/ }).click();
    await expect(page.getByRole("alert")).toHaveText("Clipboard unavailable. Select the file contents to copy them manually.");
    await page.getByRole("button", { name: "Back to repository" }).click();
    await expect(page.getByRole("heading", { name: "project" })).toBeVisible();
    await page.getByRole("button", { name: "Scan Repository" }).click();
    await expect(page.getByRole("heading", { name: "Security scans" })).toBeVisible();
  });

  test("scan creation and cancellation expose recoverable failures and dependency opt-in", async ({ page }) => {
    const state = installWorkspaceApi(page, { failNext: { scanStart: "Scanner queue is unavailable", scanCancel: "Cancellation failed" } });
    await page.goto("/github/team/project/scan");
    await expect(page.getByRole("heading", { name: "Security scans" })).toBeVisible();
    const dependencyConsent = page.getByRole("checkbox", { name: /Include dependency advisories/ });
    await dependencyConsent.check();
    await page.getByRole("button", { name: "New scan" }).click();
    await expect(page.getByRole("alert")).toHaveText("Scanner queue is unavailable Retry");
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByRole("button", { name: "New scan" })).toBeVisible();
    await page.getByRole("button", { name: "New scan" }).click();
    expect(state.calls.filter(call => call.method === "POST" && call.pathname.endsWith("/repositories/team/project")).at(-1).body).toEqual({ includeDependencies: true });
    await expect(page.getByText("Waiting for the worker…")).toBeVisible();
    await page.getByRole("button", { name: "Cancel scan" }).click();
    await expect(page.getByRole("alert")).toHaveText("Cancellation failed Retry");
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByRole("button", { name: "Cancel scan" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel scan" }).click();
    await expect(page.getByText("FAILED", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel scan" })).toHaveCount(0);
  });

  test("repository automation keeps GitHub event triggers disabled until webhook setup is ready", async ({ page }) => {
    const state = installWorkspaceApi(page, { automation: { settings: { push: false, pullRequest: false, frequency: "off" }, webhookReady: false } });
    await page.goto("/github/team/project");
    await page.getByText("Repository automation").click();
    await expect(page.getByText(/require the deployment's webhook setup/)).toBeVisible();
    const push = page.getByRole("checkbox", { name: "Scan default-branch pushes" });
    const pullRequest = page.getByRole("checkbox", { name: "Scan opened/updated pull requests" });
    await expect(push).toBeDisabled();
    await expect(pullRequest).toBeDisabled();
    await page.getByLabel("Schedule").selectOption("weekly");
    await page.getByRole("button", { name: "Save automation" }).click();
    expect(state.automation.settings.frequency).toBe("weekly");
    expect(state.automation.settings.push).toBe(false);
    expect(state.automation.settings.pullRequest).toBe(false);
  });

  test("scan history, exports, comparison, risk filtering, pagination, and review controls", async ({ page }) => {
    const state = installWorkspaceApi(page, { failNext: { review: "Review save failed" } });
    await page.goto("/github/team/project/scan");
    await expect(page.getByRole("heading", { name: "Unsafe query" })).toBeVisible();
    const history = page.getByRole("combobox", { name: "Scan history" });
    await history.selectOption("scan-0");
    await expect(page.getByRole("link", { name: "Commit def987654321" })).toBeVisible();
    await history.selectOption("scan-1");
    await expect(page.getByRole("link", { name: "Commit abc123456789" })).toBeVisible();
    await page.getByText("Scanner coverage and provenance").click();
    await expect(page.getByText(/rules-1/)).toBeVisible();
    await page.getByText("Scanner coverage and provenance").click();
    await expect(page.getByText(/rules-1/)).toBeHidden();

    for (const format of ["json", "sarif"]) {
      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("link", { name: `Export ${format.toUpperCase()}` }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe(`scan.${format}`);
    }

    await page.getByRole("button", { name: "Compare with previous scan" }).click();
    await expect(page.getByRole("heading", { name: "Changes since the previous successful scan" })).toBeVisible();
    for (const kind of ["new", "persistent", "fixed"]) {
      const summary = page.locator("summary").filter({ hasText: new RegExp(`^${kind}$`, "i") });
      await summary.click();
      await expect(summary.locator("..") ).toHaveAttribute("open", "");
      await summary.click();
    }

    const risk = page.getByRole("combobox", { name: "Risk filter" });
    await risk.selectOption("critical");
    await expect.poll(() => state.calls.some(call => call.pathname.endsWith("/scans/scan-1/findings") && call.search.includes("riskCategory=critical"))).toBe(true);
    const pagination = page.getByRole("navigation", { name: "Findings pagination" });
    await expect(pagination.getByRole("button", { name: "Previous" })).toBeDisabled();
    await pagination.getByRole("button", { name: "Next" }).click();
    await expect(pagination).toContainText("Page 2 of 2 · 30 matching findings");
    await pagination.getByRole("button", { name: "Previous" }).click();
    await expect(pagination).toContainText("Page 1 of 2 · 30 matching findings");

    const card = page.getByRole("heading", { name: "Unsafe query" }).locator("xpath=ancestor::div[contains(@class,'overflow-hidden')][1]");
    await card.getByRole("button", { name: "Expand finding" }).click();
    await expect(card.getByText("Untrusted input reaches a query.")).toBeVisible();
    await card.getByLabel("Review status").selectOption("acknowledged");
    await card.getByLabel("Reason").fill("Confirmed for the follow-up sprint.");
    await card.getByRole("button", { name: "Save review" }).click();
    await expect(card.getByRole("alert")).toHaveText("Review save failed");
    await card.getByRole("button", { name: "Collapse finding" }).click();
    await expect(card.getByLabel("Reason")).toHaveCount(0);
    await card.getByRole("button", { name: "Expand finding" }).click();
    await expect(card.getByLabel("Reason")).toHaveValue("Confirmed for the follow-up sprint.");
    await card.getByRole("button", { name: "Save review" }).click();
    await expect.poll(() => state.calls.filter(call => call.method === "PATCH" && call.pathname.endsWith("/findings/finding-1")).length).toBe(2);
    expect(state.calls.filter(call => call.method === "PATCH" && call.pathname.endsWith("/findings/finding-1")).at(-1).body).toEqual({ status: "acknowledged", reason: "Confirmed for the follow-up sprint." });
    await expect(card.getByLabel("Reason")).toHaveCount(0);
  });

  test("organization findings page filters, retries, paginates, and expands review links", async ({ page }) => {
    const state = installWorkspaceApi(page, { failNext: { findings: { message: "Findings API temporarily unavailable", remaining: 2 }, review: "Review was rejected" } });
    await page.goto("/findings");
    await expect(page.getByRole("alert")).toContainText("Findings API temporarily unavailable");
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByRole("heading", { name: "Unsafe query" })).toBeVisible();

    const filter = page.getByRole("combobox", { name: "Risk filter" });
    for (const value of ["critical", "high", "medium", "low", "all"]) {
      const previousCallCount = state.calls.length;
      await filter.selectOption(value);
      await expect.poll(() => state.calls.slice(previousCallCount).some(call => call.pathname.endsWith("/scans/organizations/org-a/findings") && (value === "all" ? !call.search.includes("riskCategory") : call.search.includes(`riskCategory=${value}`)))).toBe(true);
    }
    const pagination = page.getByRole("navigation", { name: "Findings pagination" });
    await expect(pagination.getByRole("button", { name: "Previous" })).toBeDisabled();
    await pagination.getByRole("button", { name: "Next" }).click();
    await expect(pagination).toContainText("2/2 · 30 findings");
    await expect(pagination.getByRole("button", { name: "Next" })).toBeDisabled();
    await pagination.getByRole("button", { name: "Previous" }).click();
    await expect(pagination).toContainText("1/2 · 30 findings");

    const card = page.getByRole("heading", { name: "Unsafe query" }).locator("xpath=ancestor::div[contains(@class,'overflow-hidden')][1]");
    await expect(card.getByRole("link", { name: /Explain with Nemotron/ })).toHaveAttribute("href", "/assistant?findingId=finding-1&org=org-a");
    await expect(card.getByRole("link", { name: /Draft a fix/ })).toHaveAttribute("href", "/assistant?findingId=finding-1&org=org-a&mode=review");
    await card.getByRole("button", { name: "Expand finding" }).click();
    await expect(card.getByRole("link", { name: "View exact scanned source" })).toHaveAttribute("href", "https://github.com/team/project/blob/abc123456789/src/index.js#L3");
    await card.getByLabel("Review status").selectOption("dismissed");
    await card.getByLabel("Reason").fill("False positive after manual review.");
    await card.getByRole("button", { name: "Save review" }).click();
    await expect(card.getByRole("alert")).toHaveText("Review was rejected");
    await card.getByRole("button", { name: "Save review" }).click();
    await expect.poll(() => state.calls.filter(call => call.method === "PATCH" && call.pathname.endsWith("/findings/finding-1")).length).toBe(2);
    await card.getByRole("button", { name: "Collapse finding" }).click();
    await expect(card.getByLabel("Reason")).toHaveCount(0);
  });

  test("sign-out reports failure and remains retryable", async ({ page }) => {
    const state = installWorkspaceApi(page, { failNext: { logout: "Sign-out could not be confirmed. Please retry." } });
    await page.goto("/dashboard");
    await page.getByTitle("Sign out").click();
    await expect(page.getByRole("alert")).toContainText("Sign-out could not be confirmed");
    await page.getByTitle("Sign out").click();
    await expect(page.getByRole("heading", { name: /Review security findings in their source context/i })).toBeVisible();
    expect(state.calls.filter(call => call.pathname.endsWith("/auth/logout")).map(call => call.method)).toEqual(["POST", "POST"]);
  });

  test("workspace context retry recovers after the organizations request fails", async ({ page }) => {
    const state = installWorkspaceApi(page, { failNext: { organizations: { message: "Workspace list unavailable", remaining: 2 } } });
    await page.goto("/dashboard");
    await expect(page.getByRole("alert")).toContainText("Workspace list unavailable");
    await expect(page.getByRole("alert")).toContainText("We couldn’t load your account.");
    await expect(page.getByText("Account unavailable").first()).toBeVisible();
    await expect(page.getByText("Authenticated user")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Create workspace" })).toHaveCount(0);
    state.failNext.organizations.remaining = 0;
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByRole("heading", { name: "Demo Team" })).toBeVisible();
    expect(state.calls.filter(call => call.method === "GET" && call.pathname.endsWith("/organizations")).length).toBeGreaterThanOrEqual(2);
  });

  test("GitHub empty-state add action and refresh recover from repository errors", async ({ page }) => {
    const state = installWorkspaceApi(page, { repositories: [] });
    await page.goto("/github");
    await expect(page.getByRole("heading", { name: "No repositories found" })).toBeVisible();
    await page.getByRole("button", { name: "Add repository" }).last().click();
    const dialog = page.getByRole("heading", { name: "Add repository" });
    await expect(dialog).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();

    state.failNext.repositories = "Repository list unavailable";
    await page.getByRole("button", { name: "Refresh" }).click();
    await expect(page.getByText("Repository list unavailable")).toBeVisible();
    await page.getByRole("button", { name: "Refresh" }).click();
    await expect(page.getByRole("heading", { name: "No repositories found" })).toBeVisible();
  });

  test("scan history retry reloads history after the initial list request fails", async ({ page }) => {
    const state = installWorkspaceApi(page, { failNext: { scanHistory: { message: "Scan history unavailable", remaining: 2 } } });
    await page.goto("/github/team/project/scan");
    await expect(page.getByRole("alert")).toContainText("Scan history unavailable");
    const initialHistoryCalls = state.calls.filter(call => call.pathname.endsWith("/repositories/team/project") && call.method === "GET").length;
    // StrictMode may issue one or two requests during the initial mount. Stop
    // the fixture failure before Retry so it tests only the user's retry action.
    state.failNext.scanHistory.remaining = 0;
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByRole("link", { name: "Commit abc123456789" })).toBeVisible();
    expect(state.calls.filter(call => call.pathname.endsWith("/repositories/team/project") && call.method === "GET").length).toBeGreaterThan(initialHistoryCalls);
  });

  test("workspace header theme toggle updates the shared appearance", async ({ page }) => {
    installWorkspaceApi(page);
    await page.goto("/github");
    await expect(page.getByRole("heading", { name: "project", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Use light appearance" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(245, 247, 245)");
    await expect(page.getByRole("button", { name: "Use dark appearance" })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Use dark appearance" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });
});

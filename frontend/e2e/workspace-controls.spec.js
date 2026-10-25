import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

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
    revoked: false,
    revokedInstallationId: 10,
    dashboardCurrentFindingsStatus: { repositoriesWithScans: 1, repositoriesWithSuccessfulBaseline: 1, repositoriesUsingEarlierSuccessfulResult: 0, repositoriesWithoutSuccessfulBaseline: 0 },
    findingsFreshness: { repositoriesWithSuccessfulBaseline: 1, repositoriesUsingEarlierSuccessfulResult: 0, repositoriesWithoutSuccessfulBaseline: 0 },
    auditEvents: [{ _id: "audit-1", actorLabel: "Demo Reviewer", action: "finding.reviewed", target: "finding/finding-1",
      details: { repository: "team/project", status: "acknowledged" }, createdAt: "2026-10-21T10:00:00.000Z" }],
    auditWriteFailed: false,
    notifications: [{ _id: "notification-1", type: "scan.partial", title: "Scan needs review", body: "Some scanner coverage is missing. Review the scan before treating the repository as clean.",
      href: "/github/team/project/scan?scanId=scan-1", scan: "scan-1", repository: "team/project", createdAt: "2026-10-21T10:00:00.000Z", readAt: null },
      { _id: "notification-0", type: "scan.completed", title: "Scan completed", body: "2 findings detected · 0 critical · 1 high.",
        href: "/github/team/project/scan?scanId=scan-0", scan: "scan-0", repository: "team/project", createdAt: "2026-10-20T10:00:00.000Z", readAt: "2026-10-20T10:05:00.000Z" }],
    scanNotificationsEnabled: true,
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
    reviewDecisions: new Map(),
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
          totals: { scans: 2, findings: 2, criticalAndHigh: 1, currentFindings: 2, currentCriticalAndHigh: 1 }, riskDistribution: { critical: 0, high: 1, medium: 1, low: 0 },
          currentRiskDistribution: { critical: 0, high: 1, medium: 1, low: 0 },
          currentFindingsStatus: state.dashboardCurrentFindingsStatus,
          recentScans: [state.scans[0]], priorityFindings: [finding()], scannerStatus: { semgrep: { status: "completed", scanAt: "2026-10-20T00:00:00.000Z" } },
        };
      }
    } else if (/\/github\/organizations\/[^/]+\/status$/.test(pathname)) {
      if (!failOnce("githubStatus")) data = state.revoked
        ? { connected: false, installation: null, revoked: true, revokedInstallationId: state.revokedInstallationId }
        : { connected: state.connected, installation: state.connected ? { htmlUrl: "https://github.com/settings/installations/10" } : null };
    } else if (/\/github\/organizations\/[^/]+\/repositories$/.test(pathname)) {
      if (!failOnce("repositories")) data = { repositories: state.repositories };
    } else if (pathname.endsWith("/github/installations")) data = state.installations;
    else if (pathname.endsWith("/github/test")) data = { slug: "avpr-net" };
    else if (/\/github\/organizations\/[^/]+\/connect$/.test(pathname) && method === "POST") {
      if (!failOnce("connect")) { state.connected = true; state.revoked = false; data = { connected: true }; }
    } else if (pathname.endsWith("/repositories/team/project/files")) {
      if (!failOnce("files")) data = { files: state.files };
    } else if (pathname.endsWith("/repositories/team/project/file")) {
      if (!failOnce("file")) data = state.file;
    } else if (pathname.endsWith("/organizations/org-a/repositories/team/project/automation")) {
      if (method === "PUT") {
        if (!failOnce("automationSave")) state.automation.settings = JSON.parse(request.postData());
      }
      if (status < 400) data = { settings: state.automation.settings, webhookReady: state.automation.webhookReady,
        ...(state.automation.eventReadiness ? { eventReadiness: state.automation.eventReadiness } : {}) };
    } else if (pathname.endsWith("/organizations/org-a/members") && method === "GET") {
      if (!failOnce("members")) data = { members: state.members };
    } else if (pathname.endsWith("/organizations/org-a/ownership-transfer") && method === "POST") {
      if (!failOnce("ownershipTransfer")) {
        const { newOwnerId } = JSON.parse(request.postData());
        state.organizations = state.organizations.map(org => org.id === "org-a" ? { ...org, role: "admin" } : org);
        state.members = state.members.map(member => member.user.id === "test-user" ? { ...member, role: "admin" }
          : member.user.id === newOwnerId ? { ...member, role: "owner" } : member);
        data = { newOwner: { userId: newOwnerId, role: "owner" }, currentUserRole: "admin" };
      }
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
    } else if (pathname.endsWith("/organizations/org-a/audit-events")) {
      data = { events: state.auditEvents, pagination: { page: 1, limit: 20, total: state.auditEvents.length, totalPages: 1 } };
    } else if (pathname.endsWith("/organizations/org-a/notifications/read-all") && method === "PATCH") {
      if (!failOnce("notificationReadAll")) {
        state.notifications = state.notifications.map(item => item.readAt ? item : { ...item, readAt: new Date().toISOString() });
        data = { markedRead: state.notifications.filter(item => item.readAt).length };
      }
    } else if (pathname.match(/\/organizations\/org-a\/notifications\/[^/]+\/read$/) && method === "PATCH") {
      const id = pathname.split("/").at(-2);
      const item = state.notifications.find(notification => notification._id === id);
      if (item && !item.readAt) item.readAt = new Date().toISOString();
      data = { notification: item };
    } else if (pathname.endsWith("/organizations/org-a/notifications") && method === "GET") {
      if (!failOnce("notifications")) data = { notifications: state.notifications, unreadCount: state.notifications.filter(item => !item.readAt).length,
        preferences: { scanResults: state.scanNotificationsEnabled }, pagination: { page: 1, limit: 10, total: state.notifications.length, totalPages: 1 } };
    } else if (pathname.endsWith("/organizations/org-a/notification-preferences") && method === "PATCH") {
      if (!failOnce("notificationPreference")) state.scanNotificationsEnabled = JSON.parse(request.postData()).scanResults;
      if (status < 400) data = { preferences: { scanResults: state.scanNotificationsEnabled } };
    } else if (pathname.endsWith("/organizations/org-a/notification-preferences") && method === "GET") {
      data = { preferences: { scanResults: state.scanNotificationsEnabled } };
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
      if (!failOnce("comparison")) data = { new: [finding("finding-new")], persistent: [finding()], fixed: [], canCompare: true, canInferFixed: true, limitation: "Same scanner coverage." };
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
      if (!failOnce("review")) {
        const findingId = pathname.split("/").at(-1);
        const decision = JSON.parse(request.postData());
        const previous = state.reviewDecisions.get(findingId)?.reviewHistory || [];
        const entry = { status: decision.status, reason: decision.reason, reviewedBy: { name: "Demo Reviewer" }, reviewedAt: "2026-10-21T10:00:00.000Z" };
        const updated = { ...entry, reviewHistory: [...previous, entry] };
        state.reviewDecisions.set(findingId, updated);
        data = { ...finding(findingId, decision.status), ...updated };
      }
    } else if (/\/scans\/[^/]+\/findings$/.test(pathname)) {
      if (!failOnce("scanFindings")) {
        const pageNumber = Number(searchParams.get("page") || 1);
        const items = pageNumber === 1 ? [finding()] : [finding("finding-2")];
        for (const item of items) Object.assign(item, state.reviewDecisions.get(item._id));
        data = { findings: items, pagination: { page: pageNumber, total: 30, totalPages: 2 } };
      }
    } else if (pathname.endsWith("/scans/organizations/org-a/findings")) {
      if (!failOnce("findings")) {
        const pageNumber = Number(searchParams.get("page") || 1);
        const items = pageNumber === 1 ? [finding()] : [finding("finding-2")];
        for (const item of items) Object.assign(item, state.reviewDecisions.get(item._id));
        data = { findings: items, latestScans: [{ scan: "scan-1", commitSha: "abc123456789" }], latestFindingsFreshness: state.findingsFreshness, pagination: { page: pageNumber, total: 30, totalPages: 2 } };
      }
    } else if (/\/scans\/[^/]+$/.test(pathname)) {
      if (!failOnce("scanStatus")) data = state.scans.find(scan => scan._id === pathname.split("/").at(-1)) || state.scans[0];
    } else if (pathname.endsWith("/organizations/invitations/accept") && method === "POST") data = { organization: { id: "org-a", name: "Demo Team" } };

    const scanDelay = pathname.endsWith("/scans/scan-1/findings") ? state.scanFindingsDelayMs
      : pathname.endsWith("/scans/organizations/org-a/repositories/team/project") && method === "GET" ? state.scanHistoryDelayMs : 0;
    if (scanDelay) await new Promise(resolve => setTimeout(resolve, scanDelay));
    await route.fulfill({ status, contentType: "application/json",
      headers: state.auditWriteFailed && method !== "GET" ? { "X-SecurePatch-Audit-Recorded": "false" } : undefined,
      body: JSON.stringify(status >= 400 ? { success: false, ...data } : { success: true, data,
        ...(pathname.endsWith("/github/installations") ? {authorization:{verified:true,username:"team"}} : {}) }) });
  });
  return state;
}

test.describe("workspace controls, with mocked APIs", () => {
  test("repository files show real raster previews, inert SVG source, and a useful fallback", async ({ page }) => {
    const state = installWorkspaceApi(page);
    const ref = "a".repeat(40);
    state.file = { path: "icon.png", kind: "image", encoding: "base64", mimeType: "image/png",
      content: readFileSync(new URL("../public/securepatch-favicon.png", import.meta.url)).toString("base64") };
    await page.goto(`/github/team/project/file?path=icon.png&ref=${ref}`);
    const image = page.getByRole("img", { name: "icon.png", exact: true });
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate(element => element.naturalWidth)).toBeGreaterThan(0);
    await expect(page.getByRole("link", { name: "Open file on GitHub" })).toHaveAttribute("href", `https://github.com/team/project/blob/${ref}/icon.png`);
    const svg = '<svg><script>window.__untrustedSvgRan = true</script></svg>';
    state.file = { path: "icon.svg", content: svg };
    await page.goto(`/github/team/project/file?path=icon.svg&ref=${ref}`);
    await expect(page.getByText(svg, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.__untrustedSvgRan)).toBeUndefined();
    state.file = { path: "broken.png", kind: "image", encoding: "base64", mimeType: "image/png", content: "iVBORw0KGgo=" };
    await page.goto(`/github/team/project/file?path=broken.png&ref=${ref}`);
    await expect(page.getByText("This image could not be displayed. Open the file on GitHub.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open file on GitHub" })).toHaveAttribute("href", `https://github.com/team/project/blob/${ref}/broken.png`);
  });

  test("a late comparison cannot appear under a different selected scan", async ({ page }) => {
    installWorkspaceApi(page);
    let release, entered;
    const waiting = new Promise(resolve => { release = resolve; });
    const started = new Promise(resolve => { entered = resolve; });
    await page.route("**/scans/scan-1/comparison", async route => {
      entered(); await waiting;
      await route.fulfill({ json: { success: true, data: { canCompare: false, limitation: "Comparison from the previously selected scan" } } });
    });
    await page.goto("/github/team/project/scan");
    await page.getByRole("button", { name: "Compare with previous scan" }).click();
    await started;
    await page.getByLabel("Scan history").selectOption("scan-0");
    await expect(page.getByRole("link", { name: "View scanned commit def987654321" })).toBeVisible();
    release(); await page.waitForLoadState("networkidle");
    await expect(page.getByText("Comparison from the previously selected scan")).toHaveCount(0);
  });

  test("a late notification refresh cannot replace the selected workspace's notifications", async ({ page }) => {
    installWorkspaceApi(page);
    let release, entered, pauseOld = false;
    const waiting = new Promise(resolve => { release = resolve; });
    const started = new Promise(resolve => { entered = resolve; });
    await page.route("**/organizations/*/notifications?*", async route => {
      const isOther = route.request().url().includes("/org-b/");
      const delayed = !isOther && pauseOld;
      if (delayed) { entered(); await waiting; }
      await route.fulfill({ json: { success: true, data: { notifications: [], unreadCount: isOther ? 2 : delayed ? 99 : 1,
        preferences: { scanResults: true } } } });
    });
    await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: "Notifications, 1 unread", exact: true })).toBeVisible();
    pauseOld = true;
    await page.getByRole("button", { name: "Notifications, 1 unread", exact: true }).click();
    await started;
    await page.getByRole("combobox").first().selectOption("org-b");
    await expect(page.getByRole("button", { name: "Notifications, 2 unread", exact: true })).toBeVisible();
    release(); await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "Notifications, 2 unread", exact: true })).toBeVisible();
  });

  test("dashboard refresh, workspace selector, organization form, retry, and mobile navigation", async ({ page }) => {
    const state = installWorkspaceApi(page, { failNext: { createOrganization: "Organization create failed" } });
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Demo Team" })).toBeVisible();
    await expect(page.getByText("Current unresolved")).toBeVisible();
    await expect(page.getByText("Current critical + high")).toBeVisible();

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

    // The heading appears before the new workspace's initial overview request completes.
    // Inject the refresh failure only once that request has settled (including StrictMode's replay).
    await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeEnabled();
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
    await expect(page.getByRole("heading", { name: "Repositories", exact: true })).toBeVisible();
  });

  test("dashboard preserves the full-scan baseline and identifies repositories without one", async ({ page }) => {
    const state = installWorkspaceApi(page);
    state.dashboardCurrentFindingsStatus = {
      repositoriesWithScans: 2,
      repositoriesWithSuccessfulBaseline: 1,
      repositoriesUsingEarlierSuccessfulResult: 1,
      repositoriesWithoutSuccessfulBaseline: 2,
    };
    await page.goto("/dashboard");
    await expect(page.getByText(/Newer scans are partial, failed, or still running for 1 repository/)).toBeVisible();
    await expect(page.getByText(/2 repositories have no full-coverage scan yet and are excluded from current findings/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Prioritized findings" })).toBeVisible();
  });

  test("organization findings explain stale baselines and repositories without a complete scan", async ({ page }) => {
    const state = installWorkspaceApi(page);
    state.findingsFreshness = { repositoriesWithSuccessfulBaseline: 1, repositoriesUsingEarlierSuccessfulResult: 1, repositoriesWithoutSuccessfulBaseline: 1 };
    await page.goto("/findings");
    await expect(page.getByRole("status").filter({ hasText: "Newer scans are partial or failed for 1 repository" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "1 repository has no complete scan baseline yet" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Findings" })).toBeVisible();
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

  test("owner can transfer ownership only after selecting an active teammate and confirming the organization name", async ({ page }) => {
    const state = installWorkspaceApi(page);
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Transfer ownership" })).toBeVisible();
    const target = page.getByLabel("New owner");
    const confirmation = page.getByRole("textbox", { name: "Confirm organization name" });
    const submit = page.getByRole("button", { name: "Transfer ownership" });
    await expect(target.locator("option")).toHaveText(["Select an active teammate", "Teammate · developer"]);
    await expect(submit).toBeDisabled();
    await target.selectOption("member-1");
    await confirmation.fill("Different Team");
    await expect(submit).toBeDisabled();
    await confirmation.fill("Demo Team");
    await submit.click();

    await expect(page.getByRole("status").filter({ hasText: "Ownership transferred to Teammate. Your role is now admin." })).toBeVisible();
    await expect(page.getByText("Demo Team · Your role: admin")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Transfer ownership" })).toHaveCount(0);
    expect(state.organizations.find(org => org.id === "org-a").role).toBe("admin");
    expect(state.members.find(member => member.user.id === "member-1").role).toBe("owner");
    expect(state.calls.find(call => call.pathname.endsWith("/ownership-transfer"))).toMatchObject({
      method: "POST", body: { newOwnerId: "member-1", confirmation: "Demo Team" },
    });
  });

  test("workspace settings show actor, action, target, and time in the security activity log", async ({ page }) => {
    installWorkspaceApi(page);
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Recent security activity" })).toBeVisible();
    await expect(page.getByText("Demo Reviewer marked a finding acknowledged in team/project.")).toBeVisible();
    await expect(page.locator("time[datetime='2026-10-21T10:00:00.000Z']")).toBeVisible();
  });

  test("settings explain when a change saves but the audit record is unavailable", async ({ page }) => {
    const state = installWorkspaceApi(page);
    state.auditWriteFailed = true;
    await page.goto("/settings");
    await page.getByLabel("Email address").fill("new@example.test");
    await page.getByRole("button", { name: "Create invite link" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Your change was saved, but its activity record could not be written" })).toBeVisible();
    expect(state.invitations.some(invitation => invitation.email === "new@example.test")).toBe(true);
  });

  test("GitHub install selection, connect errors, refresh, repository cards, and modal controls", async ({ page }) => {
    const state = installWorkspaceApi(page, { connected: false, failNext: { connect: "Installation could not be connected" } });
    await page.goto("/github");
    await expect(page.getByRole("heading", { name: "Connect repositories to this workspace" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in with GitHub" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Install GitHub App" })).toHaveAttribute("href", "https://github.com/apps/avpr-net/installations/new");
    await page.getByLabel("GitHub installation").selectOption("11");
    await page.getByRole("button", { name: "Connect installation" }).click();
    await expect(page.getByText("Installation could not be connected")).toBeVisible();
    await page.getByRole("button", { name: "Connect installation" }).click();
    await expect(page.getByRole("heading", { name: "Repositories", exact: true })).toBeVisible();
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
    const manageAccess = page.getByRole("link", { name: "Open GitHub settings" });
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

  test("newly authorized repositories appear on return from GitHub without signing out", async ({ page }) => {
    const state = installWorkspaceApi(page);
    let forcedRefresh = false;
    page.on("request", request => {
      const url = new URL(request.url());
      if (url.pathname.endsWith("/repositories") && url.searchParams.get("refresh") === "true") forcedRefresh = true;
    });
    await page.goto("/github");
    await expect(page.getByRole("button", { name: /project team\/project/i })).toBeVisible();
    state.repositories.push({ id: 99, owner: "team", name: "newly-authorized", fullName: "team/newly-authorized", defaultBranch: "main", private: true });
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.getByRole("button", { name: /newly-authorized team\/newly-authorized/i })).toBeVisible();
    expect(forcedRefresh).toBe(true);
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    expect(state.calls.some(call => call.pathname.endsWith("/auth/logout"))).toBe(false);
  });

  test("a revoked installation is clearly explained and can be replaced", async ({ page }) => {
    const state = installWorkspaceApi(page, { connected: false, revoked: true, revokedInstallationId: 10 });
    await page.goto("/github");

    await expect(page.getByRole("status")).toContainText("AVPR-Net was removed from this organization");
    const installationOptions = await page.locator("#github-installation option").allTextContents();
    expect(installationOptions).toEqual(["team-labs"]);
    await page.getByLabel("GitHub installation").selectOption("11");
    await page.getByRole("button", { name: "Connect installation" }).click();

    await expect(page.getByRole("heading", { name: "Repositories", exact: true })).toBeVisible();
    expect(state.connected).toBe(true);
    expect(state.revoked).toBe(false);
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
    await expect(page.getByRole("alert")).toContainText("Automation save failed");
    await page.getByRole("button", { name: "Save automation" }).click();
    expect(state.automation.settings).toEqual({ push: true, pullRequest: true, frequency: "monthly" });
    await expect(page.getByRole("status")).toHaveText("Automation settings saved.");

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
    await expect(page.getByRole("alert")).toContainText("Scanner queue is unavailable");
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByRole("button", { name: "New scan" })).toBeVisible();
    await page.getByRole("button", { name: "New scan" }).click();
    expect(state.calls.filter(call => call.method === "POST" && call.pathname.endsWith("/repositories/team/project")).at(-1).body).toEqual({ includeDependencies: true });
    await expect(page.getByText("Waiting for the worker…")).toBeVisible();
    await page.getByRole("button", { name: "Cancel scan" }).click();
    await expect(page.getByRole("alert")).toContainText("Cancellation failed");
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
    await expect(page.getByRole("heading", { name: "What was checked" })).toBeVisible();
    await page.getByText("Technical scan record").click();
    await expect(page.getByText(/rules-1/)).toBeVisible();
    await page.getByText("Technical scan record").click();
    await expect(page.getByText(/rules-1/)).toBeHidden();

    for (const format of ["json", "sarif"]) {
      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("link", { name: `Export ${format.toUpperCase()}` }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe(`scan.${format}`);
    }

    await page.getByRole("button", { name: "Compare with previous scan" }).click();
    await expect(page.getByRole("heading", { name: "Scan comparison" })).toBeVisible();
    await expect(page.getByText(/Changes since the previous successful scan · New: 1 · Persistent: 1 · Fixed: 0/)).toBeVisible();
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
    await card.getByRole("button", { name: "Save decision" }).click();
    await expect(card.getByRole("alert")).toHaveText("Review save failed");
    await card.getByRole("button", { name: "Collapse finding" }).click();
    await expect(card.getByLabel("Reason")).toHaveCount(0);
    await card.getByRole("button", { name: "Expand finding" }).click();
    await expect(card.getByLabel("Reason")).toHaveValue("Confirmed for the follow-up sprint.");
    await card.getByRole("button", { name: "Save decision" }).click();
    await expect.poll(() => state.calls.filter(call => call.method === "PATCH" && call.pathname.endsWith("/findings/finding-1")).length).toBe(2);
    expect(state.calls.filter(call => call.method === "PATCH" && call.pathname.endsWith("/findings/finding-1")).at(-1).body).toEqual({ status: "acknowledged", reason: "Confirmed for the follow-up sprint." });
    await expect(card.getByLabel("Reason")).toHaveValue("");
    await expect(card.getByRole("status")).toHaveText("Review decision saved with its reason and timestamp.");
  });

  test("scan refresh keeps the last good findings visible after a request fails", async ({ page }) => {
    const state = installWorkspaceApi(page);
    await page.goto("/github/team/project/scan");
    let card = page.getByRole("heading", { name: "Unsafe query" }).locator("xpath=ancestor::div[contains(@class,'overflow-hidden')][1]");
    await expect(card).toBeVisible();
    state.failNext.scanFindings = { message: "Latest findings could not be refreshed", remaining: 1 };
    await card.getByRole("button", { name: "Expand finding" }).click();
    await card.getByLabel("Review status").selectOption("acknowledged");
    await card.getByLabel("Reason").fill("Confirmed during manual review.");
    await card.getByRole("button", { name: "Save decision" }).click();
    await expect(page.getByRole("alert")).toContainText("Latest findings could not be refreshed");
    card = page.getByRole("heading", { name: "Unsafe query" }).locator("xpath=ancestor::div[contains(@class,'overflow-hidden')][1]");
    await expect(card).toBeVisible();
    await expect(page.getByText("Existing scan details remain from the last successful load.")).toBeVisible();
  });

  test("scan selection announces that scan details are loading", async ({ page }) => {
    installWorkspaceApi(page, { scanFindingsDelayMs: 600 });
    await page.goto("/github/team/project/scan");
    await expect(page.getByRole("status")).toContainText("Loading scan details");
    await expect(page.getByRole("heading", { name: "Unsafe query" })).toBeVisible();
  });

  test("scan history announces that its list is loading", async ({ page }) => {
    installWorkspaceApi(page, { scanHistoryDelayMs: 600 });
    await page.goto("/github/team/project/scan");
    await expect(page.getByRole("status")).toContainText("Loading scan history");
    await expect(page.getByRole("link", { name: "Commit abc123456789" })).toBeVisible();
  });

  test("organization findings page filters, retries, paginates, and expands review links", async ({ page }) => {
    const state = installWorkspaceApi(page, { failNext: { findings: { message: "Findings API temporarily unavailable", remaining: 2 }, review: "Review was rejected" } });
    await page.goto("/findings");
    await expect(page.getByRole("alert")).toContainText("Findings API temporarily unavailable");
    const initialFindingsCalls = state.calls.filter(call => call.pathname.endsWith("/scans/organizations/org-a/findings")).length;
    // StrictMode can dispatch and abort a duplicate initial request. Clear any
    // fixture failures before Retry so this assertion tests the user's action.
    state.failNext.findings.remaining = 0;
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByRole("heading", { name: "Unsafe query" })).toBeVisible();
    expect(state.calls.filter(call => call.pathname.endsWith("/scans/organizations/org-a/findings")).length).toBeGreaterThan(initialFindingsCalls);

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
    await card.getByRole("button", { name: "Save decision" }).click();
    await expect(card.getByRole("alert")).toHaveText("Review was rejected");
    await card.getByRole("button", { name: "Save decision" }).click();
    await expect.poll(() => state.calls.filter(call => call.method === "PATCH" && call.pathname.endsWith("/findings/finding-1")).length).toBe(2);
    await card.getByRole("button", { name: "Collapse finding" }).click();
    await expect(card.getByLabel("Reason")).toHaveCount(0);
  });

  test("finding review requires a reason and shows reviewer history after reload", async ({ page }) => {
    const state = installWorkspaceApi(page);
    await page.goto("/findings");
    let card = page.getByRole("heading", { name: "Unsafe query" }).locator("xpath=ancestor::div[contains(@class,'overflow-hidden')][1]");
    await card.getByRole("button", { name: "Expand finding" }).click();
    await card.getByLabel("Review status").selectOption("dismissed");
    const save = card.getByRole("button", { name: "Save decision" });
    await expect(save).toBeDisabled();
    await card.getByLabel("Reason").fill("Manual review confirmed this path is unreachable.");
    await expect(save).toBeEnabled();
    await save.click();
    await expect(card.getByRole("status")).toHaveText("Review decision saved with its reason and timestamp.");
    await expect(card.getByText("Review history (1)")).toBeVisible();
    await card.getByText("Review history (1)").click();
    await expect(card.getByText("Demo Reviewer")).toBeVisible();
    await expect(card.getByText("Manual review confirmed this path is unreachable.")).toBeVisible();
    await expect(card.locator("ol")).toContainText("2026");
    expect(state.reviewDecisions.get("finding-1").reviewHistory).toHaveLength(1);

    await page.reload();
    card = page.getByRole("heading", { name: "Unsafe query" }).locator("xpath=ancestor::div[contains(@class,'overflow-hidden')][1]");
    await expect(card).toContainText("Dismissed after review");
    await card.getByRole("button", { name: "Expand finding" }).click();
    await card.getByText("Review history (1)").click();
    await expect(card.getByText("Demo Reviewer")).toBeVisible();
    await expect(card.getByText("Manual review confirmed this path is unreachable.")).toBeVisible();
  });

  test("findings retain the last successful results when a refresh fails", async ({ page }) => {
    const state = installWorkspaceApi(page);
    await page.goto("/findings");
    const card = page.getByRole("heading", { name: "Unsafe query" }).locator("xpath=ancestor::div[contains(@class,'overflow-hidden')][1]");
    await card.getByRole("button", { name: "Expand finding" }).click();
    await card.getByLabel("Review status").selectOption("acknowledged");
    await card.getByLabel("Reason").fill("Confirmed and assigned for remediation.");
    state.failNext.findings = { message: "Refresh failed after review", remaining: 1 };
    await card.getByRole("button", { name: "Save decision" }).click();
    await expect(page.getByRole("alert")).toContainText("Refresh failed after review");
    await expect(card.getByRole("heading", { name: "Unsafe query" })).toBeVisible();
    await expect(page.getByText("The results below are from the last successful load and may be out of date.")).toBeVisible();
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
    await expect(page.getByRole("heading", { name: "Repository list unavailable" })).toBeVisible();
    await page.getByRole("button", { name: "Refresh" }).click();
    await expect(page.getByRole("heading", { name: "No repositories found" })).toBeVisible();
  });

  test("GitHub keeps the last repository list visible when refresh fails", async ({ page }) => {
    const state = installWorkspaceApi(page);
    await page.goto("/github");
    await expect(page.getByRole("heading", { name: "project", exact: true })).toBeVisible();
    state.failNext.repositories = "Repository refresh unavailable";
    await page.getByRole("button", { name: "Refresh" }).click();
    await expect(page.getByRole("alert")).toContainText("Repository refresh unavailable");
    await expect(page.getByRole("heading", { name: "project", exact: true })).toBeVisible();
    await expect(page.getByText("Showing 1 repositories from the last successful load; they may be out of date.")).toBeVisible();
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
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(246, 246, 245)");
    await expect(page.getByRole("button", { name: "Use dark appearance" })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Use dark appearance" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("scan notifications open, mark as read, and persist the member's scan preference", async ({ page }) => {
    const state = installWorkspaceApi(page);
    await page.goto("/dashboard");
    const button = page.getByRole("button", { name: "Notifications, 1 unread" });
    await expect(button).toBeVisible();
    await button.click();
    const panel = page.getByRole("dialog", { name: "Notifications" });
    await expect(panel.getByText("Scan needs review")).toBeVisible();
    await expect(panel.getByText(/Some scanner coverage is missing/)).toBeVisible();
    await expect(panel.getByText("in-app only")).toBeVisible();

    const preference = panel.getByRole("checkbox", { name: "Notify me about scan results" });
    await expect(preference).toBeChecked();
    await preference.uncheck();
    await expect(preference).not.toBeChecked();
    expect(state.scanNotificationsEnabled).toBe(false);

    await panel.getByRole("button", { name: "Mark all read" }).click();
    await expect(page.getByRole("button", { name: "Notifications" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await page.getByRole("button", { name: "Notifications" }).click();
    await expect(page.getByRole("dialog", { name: "Notifications" }).getByRole("checkbox", { name: "Notify me about scan results" })).not.toBeChecked();
    await expect(page.getByRole("dialog", { name: "Notifications" }).getByRole("button", { name: "Mark all read" })).toBeDisabled();
  });

  test("opening a scan notification leads to its exact scan and recovers after a notification request failure", async ({ page }) => {
    const state = installWorkspaceApi(page);
    await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: "Notifications, 1 unread" })).toBeVisible();
    state.failNext.notifications = "Notification service unavailable.";
    await page.getByRole("button", { name: "Notifications" }).click();
    const panel = page.getByRole("dialog", { name: "Notifications" });
    await expect(panel.getByRole("alert")).toContainText("Notification service unavailable.");
    await panel.getByRole("button", { name: "Retry" }).click();
    await expect(panel.getByText("Scan needs review")).toBeVisible();
    await panel.getByRole("link", { name: /Scan needs review/ }).click();
    await expect(page).toHaveURL(/\/github\/team\/project\/scan\?scanId=scan-1$/);
    expect(state.calls.some(call => call.pathname.endsWith("/notifications/notification-1/read"))).toBe(true);
  });

  test("notification center stays inside a narrow screen and follows the light theme", async ({ page }) => {
    installWorkspaceApi(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: "Use light appearance" })).toBeVisible();
    await page.getByRole("button", { name: "Use light appearance" }).click();
    await page.getByRole("button", { name: "Notifications, 1 unread" }).click();

    const panel = page.getByRole("dialog", { name: "Notifications" });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("checkbox", { name: "Notify me about scan results" })).toBeVisible();
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    await expect.poll(() => panel.evaluate(element => getComputedStyle(element).backgroundColor)).toBe("rgb(253, 253, 252)");
  });
  test("repository access dialog traps focus, closes with Escape, and restores its trigger", async ({ page }) => {
    installWorkspaceApi(page);
    await page.goto("/github");
    const trigger = page.getByRole("button", { name: "Add repository", exact: true }).first();
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Add repository", exact: true });
    const close = dialog.getByRole("button", { name: "Close", exact: true });
    await expect(close).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(dialog.getByRole("button", { name: "I’ve updated access — refresh" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("missing file paths stop loading and failed file requests offer a working retry", async ({ page }) => {
    installWorkspaceApi(page, { failNext: { file: "File load failed" } });
    await page.goto("/github/team/project/file");
    await expect(page.getByRole("alert")).toContainText("Select a file");
    await page.goto("/github/team/project/file?path=src%2Findex.js");
    await expect(page.getByRole("alert")).toContainText("File load failed");
    await page.getByRole("button", { name: "Retry file" }).click();
    await expect(page.getByRole("button", { name: "Copy file to clipboard" })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Repositories", exact: true })).toHaveAttribute("aria-current", "page");
  });

  test("settings section links target their sections and invite copying gives feedback", async ({ page }) => {
    installWorkspaceApi(page);
    await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", { configurable:true, value:{ writeText:async()=>{} } }));
    await page.goto("/settings");
    const nav = page.getByRole("navigation", { name: "Settings sections" });
    for (const [label,id] of [["Team","team"],["Activity","activity"],["AI privacy","privacy"],["Data","data"],["Account controls","account"]]) {
      await expect(nav.getByRole("link", { name:label,exact:true })).toHaveAttribute("href",`#${id}`);
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }
    await page.getByLabel("Email address").fill("invite@example.com");
    await page.getByRole("button", { name:"Create invite link" }).click();
    await page.getByRole("button", { name:"Copy link",exact:true }).click();
    await expect(page.getByRole("button", { name:"Copied",exact:true })).toBeVisible();
  });

});


test("automation enables only the event subscribed on the GitHub App", async ({ page }) => {
  const state = installWorkspaceApi(page, { automation: { settings: { push: false, pullRequest: false, frequency: "off" },
    webhookReady: true, eventReadiness: { push: false, pullRequest: true } } });
  await page.goto("/github/team/project");
  await page.getByText("Repository automation").click();
  await expect(page.getByRole("checkbox", { name: "Scan default-branch pushes" })).toBeDisabled();
  await page.getByRole("checkbox", { name: "Scan opened/updated pull requests" }).check();
  await page.getByRole("button", { name: "Save automation" }).click();
  expect(state.automation.settings.pullRequest).toBe(true);
  expect(state.automation.settings.push).toBe(false);
});

test("an existing event trigger can be disabled after webhook configuration becomes unavailable", async ({ page }) => {
  const state = installWorkspaceApi(page, { automation: { settings: { push: true, pullRequest: false, frequency: "weekly" },
    webhookReady: false, eventReadiness: { push: false, pullRequest: false } } });
  await page.goto("/github/team/project");
  await page.getByText("Repository automation").click();
  await page.getByRole("checkbox", { name: "Scan default-branch pushes" }).uncheck();
  await page.getByRole("button", { name: "Save automation" }).click();
  expect(state.automation.settings.push).toBe(false);
  expect(state.automation.settings.frequency).toBe("weekly");
});

test("invitation delivery labels distinguish server acceptance from delay and failure", async ({ page }) => {
  const state = installWorkspaceApi(page);
  state.invitations = ["delivered", "delayed", "bounced", "complained", "failed"].map((emailStatus, index) => ({
    id: `delivery-${index}`, email: `delivery-${index}@example.test`, role: "developer", status: "pending",
    expiresAt: "2026-10-27T00:00:00.000Z", emailStatus,
  }));
  await page.goto("/settings");
  for (const label of ["Email accepted by recipient server", "Email delivery delayed", "Email bounced — check the address",
    "Email reported as spam — do not resend", "Email failed — share the link securely"]) {
    await expect(page.getByText(label, { exact: false })).toBeVisible();
  }
});

for (const change of ["read", "preference"]) {
  test(`a delayed notification refresh cannot undo a saved ${change} change`, async ({ page }) => {
    installWorkspaceApi(page);
    let release, entered, pauseOld = false;
    const waiting = new Promise(resolve => { release = resolve; });
    const started = new Promise(resolve => { entered = resolve; });
    await page.route("**/organizations/org-a/notifications?*", async route => {
      if (pauseOld) { entered(); await waiting; }
      await route.fulfill({ json: { success: true, data: { notifications: [], unreadCount: 1,
        preferences: { scanResults: true } } } });
    });
    await page.goto("/dashboard");
    const button = page.getByRole("button", { name: "Notifications, 1 unread", exact: true });
    await expect(button).toBeVisible();
    pauseOld = true;
    await button.click(); await started;
    const panel = page.getByRole("dialog", { name: "Notifications" });
    if (change === "read") {
      await panel.getByRole("button", { name: "Mark all read" }).click();
      await expect(page.getByRole("button", { name: "Notifications", exact: true })).toBeVisible();
    } else {
      const preference = panel.getByRole("checkbox", { name: "Notify me about scan results" });
      await preference.uncheck(); await expect(preference).toBeEnabled();
    }
    release(); await page.waitForLoadState("networkidle");
    if (change === "read") await expect(page.getByRole("button", { name: "Notifications", exact: true })).toBeVisible();
    else await expect(panel.getByRole("checkbox", { name: "Notify me about scan results" })).not.toBeChecked();
  });
}

for (const emailStatus of ["accepted", "failed", "unknown"]) {
  test(`optional invitation email ${emailStatus} preserves manual sharing`, async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async text => { window.__clipboardText = text; } } }));
    installWorkspaceApi(page);
    let submitted;
    await page.route("**/organizations/org-a/invitations", async route => {
      if (route.request().method() === "POST") {
        submitted = route.request().postDataJSON();
        return route.fulfill({ json: { success: true, data: { invitation: { id: "email-invite", url: "https://example.test/invite/accept?token=fixture-token", emailDelivery: { status: emailStatus } } } } });
      }
      return route.fulfill({ json: { success: true, data: { invitations: [], emailDeliveryAvailable: true } } });
    });
    await page.goto("/settings");
    await page.getByLabel("Email address").fill("invitee@example.test");
    await expect(page.getByLabel("Email this invitation")).not.toBeChecked();
    await page.getByLabel("Email this invitation").check();
    await page.getByRole("button", { name: "Create and email invite" }).click();
    await expect(page.getByRole("textbox", { name: "Invitation link" })).toHaveValue(/fixture-token/);
    expect(submitted).toMatchObject({ email: "invitee@example.test", role: "developer", sendEmail: true });
    const text = emailStatus === "accepted" ? "Email accepted by the provider; inbox delivery is not confirmed." : emailStatus === "failed" ? "Email could not be sent. Share the invitation link securely instead." : "Email status could not be confirmed. Share the link if needed; creating another invite replaces this link.";
    await expect(page.getByText(text, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Copy link", exact: true }).click();
    expect(await page.evaluate(() => window.__clipboardText)).toContain("fixture-token");
  });
}

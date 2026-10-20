import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/**", async route => {
    const url = new URL(route.request().url()); let data;
    if (url.pathname.endsWith("/auth/me")) data = { user: { id: "test-user", name: "Demo Reviewer" } };
    else if (url.pathname.endsWith("/organizations")) data = { organizations: [{ id: "test-org", name: "Demo Team", role: "owner" }] };
    else if (url.pathname.endsWith("/members")) data = { members: [{ user: { id: "test-user", name: "Demo Reviewer", email: "test@example.com" }, role: "owner" }] };
    else if (url.pathname.endsWith("/invitations") && route.request().method() === "POST") data = { invitation: { id: "invite-1", email: "new@example.com", role: "developer", status: "pending", expiresAt: "2026-10-27T00:00:00.000Z", url: "http://127.0.0.1:5174/invite/accept?token=fixture-token" } };
    else if (url.pathname.endsWith("/invitations")) data = { invitations: [] };
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
test("unknown routes show a recoverable not-found page", async ({ page }) => {
  await page.goto("/missing-page"); await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Return home" })).toHaveAttribute("href", "/");
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

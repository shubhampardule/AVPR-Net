import React from "react";
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import GitHub from "./GitHub";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function Harness() {
  return <MemoryRouter initialEntries={["/github"]}>
    <Routes>
      <Route element={<Outlet context={{ selectedOrg: { id: "org-1", name: "AVPR-Net", role: "owner" } }} />}>
        <Route path="/github" element={<GitHub />} />
      </Route>
    </Routes>
  </MemoryRouter>;
}

const status = { connected: true, installation: { account: "shubhampardule", accountType: "User", htmlUrl: "https://github.com/settings/installations/42" } };
const repositories = [{ id: 1, name: "AVPR", fullName: "shubhampardule/AVPR", owner: "shubhampardule", defaultBranch: "main", private: true }];
const response = data => ({ ok: true, json: async () => ({ data }) });

test("shows the connected installation and refreshes repository access from the add dialog", async () => {
  const fetchMock = vi.fn(url => Promise.resolve(String(url).endsWith("/status") ? response(status) : response({ repositories })));
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  render(<Harness />);

  expect(await screen.findByText("shubhampardule", { exact: true })).toBeTruthy();
  expect(screen.getByRole("button", { name: /AVPR shubhampardule\/AVPR mainPrivate/i })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Add repository" }));
  const installationLabel = screen.getByText("Current installation:", { exact: false });
  expect(installationLabel.parentElement.textContent).toMatch(/shubhampardule.*User/);
  await user.click(screen.getByRole("button", { name: "I’ve updated access — refresh" }));

  expect((await screen.findByRole("status")).textContent).toMatch(/can now see 1 repository for shubhampardule/i);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
});

test("keeps the last repository snapshot visible and labels it stale when refresh fails", async () => {
  let refresh = false;
  const fetchMock = vi.fn(url => {
    if (String(url).endsWith("/status")) {
      if (refresh) return Promise.resolve(response(status));
      return Promise.resolve(response(status));
    }
    if (!refresh) return Promise.resolve(response({ repositories }));
    return Promise.resolve({ ok: false, json: async () => ({ error: { message: "GitHub is temporarily unavailable." } }) });
  });
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  render(<Harness />);
  await screen.findByRole("button", { name: /AVPR shubhampardule\/AVPR mainPrivate/i });
  await user.click(screen.getByRole("button", { name: "Add repository" }));
  refresh = true;
  await user.click(screen.getByRole("button", { name: "I’ve updated access — refresh" }));

  const alerts = await screen.findAllByRole("alert");
  expect(alerts.some(alert => /Couldn’t refresh repository access: GitHub is temporarily unavailable/i.test(alert.textContent))).toBe(true);
  expect(alerts.some(alert => /may be out of date/i.test(alert.textContent))).toBe(true);
});

test("does not offer a new GitHub connection when installation status could not be checked", async () => {
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({
    ok: false,
    json: async () => ({ error: { message: "GitHub status unavailable." } }),
  })));
  render(<Harness />);

  expect((await screen.findByRole("alert")).textContent).toMatch(/GitHub status unavailable/i);
  expect(screen.queryByRole("heading", { name: "Connect your GitHub account" })).toBeNull();
  expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
});

test("keeps the verified account connected when only the repository request fails", async () => {
  vi.stubGlobal("fetch", vi.fn(url => Promise.resolve(String(url).endsWith("/status")
    ? response(status)
    : { ok: false, json: async () => ({ error: { message: "Repository list timed out." } }) })));
  render(<Harness />);

  expect(await screen.findByText("shubhampardule", { exact: true })).toBeTruthy();
  expect(screen.getByText("Connected", { exact: true })).toBeTruthy();
  expect(screen.getByRole("alert").textContent).toMatch(/Repository list timed out/i);
  expect(screen.getByRole("heading", { name: "Repository list unavailable" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "No repositories found" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "Connect your GitHub account" })).toBeNull();
  expect(screen.getAllByRole("button", { name: "Add repository" }).length).toBeGreaterThan(0);
});

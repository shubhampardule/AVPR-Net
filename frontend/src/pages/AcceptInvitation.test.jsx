import React from "react";
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import AcceptInvitation from "./AcceptInvitation";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function Harness() {
  return <MemoryRouter initialEntries={["/invite/accept?token=one-time-token"]}>
    <Routes>
      <Route path="/invite/accept" element={<AcceptInvitation />} />
      <Route path="/login" element={<LoginTarget />} />
    </Routes>
  </MemoryRouter>;
}

function LoginTarget() {
  const location = useLocation();
  return <output>{new URLSearchParams(location.search).get("returnTo")}</output>;
}

test("accepts an invitation after checking the signed-in session", async () => {
  const fetch = vi.fn()
    .mockResolvedValueOnce({ status: 200, ok: true, json: async () => ({ data: { user: { email: "member@example.test" } } }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { organization: { name: "Example team" } } }) });
  vi.stubGlobal("fetch", fetch);

  render(<Harness />);

  expect(await screen.findByText("You joined Example team.")).toBeTruthy();
  expect(fetch).toHaveBeenNthCalledWith(2, "/api/v1/organizations/invitations/accept", expect.objectContaining({
    method: "POST", credentials: "include", body: JSON.stringify({ token: "one-time-token" }),
  }));
});

test("keeps the invitation token through sign-in when the visitor has no session", async () => {
  const fetch = vi.fn().mockResolvedValueOnce({ status: 401, ok: false });
  vi.stubGlobal("fetch", fetch);

  render(<Harness />);

  expect(await screen.findByText("/invite/accept?token=one-time-token")).toBeTruthy();
  expect(fetch).toHaveBeenCalledTimes(1);
});

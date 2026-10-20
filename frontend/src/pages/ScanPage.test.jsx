import React from "react";
import { test, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, Outlet } from "react-router-dom";
import ScanPage from "./ScanPage";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const ok = data => Promise.resolve({ ok: true, json: async () => ({ data }) });
function Harness({ org = "org-one" }) {
  return <MemoryRouter initialEntries={["/github/owner/repo/scan"]}><Routes><Route element={<Outlet context={{ selectedOrg: { id: org } }} />}><Route path="/github/:owner/:repo/scan" element={<ScanPage />} /></Route></Routes></MemoryRouter>;
}
test("server pagination and risk filters are requested rather than filtering one local page", async () => {
  const calls = [];
  vi.stubGlobal("fetch", vi.fn(url => {
    calls.push(String(url));
    if (url.includes("/organizations/")) return ok({ scans: [{ _id: "scan-one", status: "completed", createdAt: new Date().toISOString() }] });
    if (url.includes("/findings")) return ok({ findings: [], pagination: { total: 150, totalPages: 6, page: 1 } });
    return ok({ _id: "scan-one", status: "completed", summary: { total: 150 } });
  }));
  render(<Harness />);
  await screen.findByText("Page 1 of 6 · 150 matching findings");
  await userEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() => expect(calls.some(url => url.includes("page=2&limit=25"))).toBe(true));
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Risk filter" }), "high");
  await waitFor(() => expect(calls.some(url => url.includes("page=1&limit=25&riskCategory=high"))).toBe(true));
});
test("an old organization's late history response cannot replace the new context", async () => {
  let resolveOld;
  vi.stubGlobal("fetch", vi.fn(url => url.includes("org-one") ? new Promise(resolve => { resolveOld = resolve; }) : ok({ scans: [] })));
  const view = render(<Harness />);
  await waitFor(() => expect(resolveOld).toBeTypeOf("function"));
  view.rerender(<Harness org="org-two" />);
  resolveOld({ ok: true, json: async () => ({ data: { scans: [{ _id: "old-private-scan", createdAt: new Date().toISOString() }] } }) });
  await waitFor(() => expect(screen.getByRole("combobox", { name: "Scan history" }).options.length).toBe(1));
});

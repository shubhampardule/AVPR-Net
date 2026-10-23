import React from "react";
import { afterEach, expect, test, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RepositoryAutomation from "./RepositoryAutomation";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const org = id => ({ id, role: "owner" });
const result = (frequency, push = false) => ({ ok: true, json: async () => ({ data: {
  settings: { push, pullRequest: false, frequency }, webhookReady: true,
} }) });

test("switching workspaces hides the previous automation form until the new settings load", async () => {
  let finish;
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(result("weekly", true))
    .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })));
  const view = render(<RepositoryAutomation organization={org("org-a")} owner="team" repo="project" />);
  await waitFor(() => expect(screen.getByLabelText("Schedule").value).toBe("weekly"));
  view.rerender(<RepositoryAutomation organization={org("org-b")} owner="team" repo="project" />);
  expect(screen.queryByLabelText("Schedule")).toBeNull();
  expect(screen.getByText("Loading automation settings…")).toBeTruthy();
  await act(async () => finish(result("monthly")));
  await waitFor(() => expect(screen.getByLabelText("Schedule").value).toBe("monthly"));
});

test("a delayed response from the old workspace cannot replace the current settings", async () => {
  const pending = new Map();
  vi.stubGlobal("fetch", vi.fn(url => new Promise(resolve => pending.set(String(url).includes("org-a") ? "a" : "b", resolve))));
  const view = render(<RepositoryAutomation organization={org("org-a")} owner="team" repo="project" />);
  view.rerender(<RepositoryAutomation organization={org("org-b")} owner="team" repo="project" />);
  await act(async () => pending.get("b")(result("monthly")));
  await act(async () => pending.get("a")(result("weekly", true)));
  await waitFor(() => expect(screen.getByLabelText("Schedule").value).toBe("monthly"));
  expect(screen.getByLabelText("Scan default-branch pushes").checked).toBe(false);
});

test("a save response from the previous workspace cannot replace the newly selected workspace", async () => {
  let finishSave;
  vi.stubGlobal("fetch", vi.fn((url, options) => options?.method === "PUT"
    ? new Promise(resolve => { finishSave = resolve; })
    : Promise.resolve(result(String(url).includes("org-a") ? "weekly" : "monthly"))));
  const view = render(<RepositoryAutomation organization={org("org-a")} owner="team" repo="project" />);
  const user = userEvent.setup();
  await waitFor(() => expect(screen.getByLabelText("Schedule").value).toBe("weekly"));
  await user.click(screen.getByText("Repository automation"));
  await user.click(screen.getByRole("button", { name: "Save automation" }));
  view.rerender(<RepositoryAutomation organization={org("org-b")} owner="team" repo="project" />);
  await waitFor(() => expect(screen.getByLabelText("Schedule").value).toBe("monthly"));
  await act(async () => finishSave(result("weekly")));
  expect(screen.getByLabelText("Schedule").value).toBe("monthly");
  expect(screen.queryByText("Automation settings saved.")).toBeNull();
});

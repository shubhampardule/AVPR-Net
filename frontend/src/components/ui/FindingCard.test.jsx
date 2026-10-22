import React from "react";
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { FindingCard, findingGuidance } from "./FindingCard";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const sample = {
  _id: "finding-1", scan: "scan-1", owner: "owner", repo: "repo", filePath: "src/auth.js", startLine: 14,
  scanner: "secrets", severity: "high", riskScore: 7.4, riskCategory: "high", title: "Credential in source", status: "open",
};

test("finding guidance explains a secret risk and a concrete first action", () => {
  const guidance = findingGuidance(sample);
  expect(guidance.risk).toMatch(/credential-like value/i);
  expect(guidance.next).toMatch(/revoke or rotate/i);
});

test("review decision requires a reason and saves it through the API", async () => {
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ data: { status: "dismissed" } }) }));
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  render(<MemoryRouter><FindingCard finding={sample} organizationId="org-1" /></MemoryRouter>);

  await user.click(screen.getByRole("button", { name: "Expand finding" }));
  expect(screen.getByText(/not yet verified by a person/i)).toBeTruthy();
  const save = screen.getByRole("button", { name: "Save decision" });
  expect(save.disabled).toBe(true);
  await user.selectOptions(screen.getByRole("combobox", { name: "Review status" }), "dismissed");
  const reason = screen.getByLabelText("Reason");
  await user.click(reason);
  await user.paste("Confirmed this path is unreachable.");
  await user.click(save);

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ status: "dismissed", reason: "Confirmed this path is unreachable." });
  expect((await screen.findByRole("status")).textContent).toMatch(/decision saved/i);
});

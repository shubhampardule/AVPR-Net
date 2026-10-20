import React from "react";
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CodeBlock } from "./CodeBlock";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("reports successful copy only after the clipboard accepts the code", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
  render(<CodeBlock code="const safe = true;" filename="sample.js" />);

  await userEvent.click(screen.getByRole("button", { name: "Copy code to clipboard" }));

  expect(writeText).toHaveBeenCalledWith("const safe = true;");
  expect(screen.getByRole("button", { name: "Code copied to clipboard" })).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
});

test("shows a usable fallback when clipboard access fails", async () => {
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
  render(<CodeBlock code="const safe = true;" filename="sample.js" />);

  await userEvent.click(screen.getByRole("button", { name: "Copy code to clipboard" }));

  expect((await screen.findByRole("alert")).textContent).toContain("Clipboard unavailable. Select the code to copy it manually.");
  expect(screen.getByRole("button", { name: "Copy code to clipboard" })).toBeTruthy();
});

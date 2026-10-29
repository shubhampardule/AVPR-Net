import React from "react";
import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import PatchVerificationPanel from "./PatchVerificationPanel";

afterEach(cleanup);

test("renders all 4 verification gates and shows Not run when no status is provided", () => {
  render(<PatchVerificationPanel />);
  expect(screen.getByText("Patch integrity")).toBeTruthy();
  expect(screen.getByText("Syntax check")).toBeTruthy();
  expect(screen.getByText("Security rescan")).toBeTruthy();
  expect(screen.getByText("Tests")).toBeTruthy();

  const notRunBadges = screen.getAllByText("Not run");
  expect(notRunBadges.length).toBeGreaterThanOrEqual(4);
  expect(screen.getByText("Needs review")).toBeTruthy();
});

test("displays passed status and Verified badge when checks pass", () => {
  render(
    <PatchVerificationPanel
      status="verified"
      gates={{
        integrity: { status: "passed", result: "Patch applies cleanly." },
        syntax: { status: "passed", result: "Valid syntax." },
        rescan: { status: "passed", result: "Alert absent after patch." },
        tests: { status: "passed", result: "All tests passed." },
      }}
    />
  );
  expect(screen.getByText("Verified")).toBeTruthy();
  expect(screen.getByText("Patch applies cleanly.")).toBeTruthy();
  expect(screen.getByText("Valid syntax.")).toBeTruthy();
  expect(screen.getByText("Alert absent after patch.")).toBeTruthy();
});

test("displays Failed status and critical colors when a gate fails", () => {
  render(
    <PatchVerificationPanel
      gates={{
        integrity: { status: "passed", result: "Patch applies cleanly." },
        syntax: { status: "failed", result: "Syntax error detected." },
        rescan: { status: "not_run", result: "Not run" },
        tests: { status: "not_run", result: "Not run" },
      }}
    />
  );
  expect(screen.getByText("Failed")).toBeTruthy();
  expect(screen.getByText("Syntax error detected.")).toBeTruthy();
});

import React from "react";
import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createTwoFilesPatch } from "diff";
import PatchComparison from "./PatchComparison";

afterEach(cleanup);
const before = "function parse(value) {\n  return eval(value);\n}\n";
const after = "function parse(value) {\n  return JSON.parse(value);\n}\n";
const patch = createTwoFilesPatch("a/index.js", "b/index.js", before, after);

test("shows exact before/after source and preserves the original patch in unified view", async () => {
  render(<PatchComparison filename="index.js" commitSha="abcdef1234" originalCode={before} patch={patch} />);
  expect(screen.getByRole("heading", { name: "Before Scanned source" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "After Proposed source" })).toBeTruthy();
  expect(screen.getByText("return eval(value);")).toBeTruthy();
  expect(screen.getByText("return JSON.parse(value);")).toBeTruthy();
  expect(screen.getByText(/Scanned commit abcdef1/)).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Unified diff" }));
  expect(screen.getByRole("region").querySelector("code").textContent).toBe(patch);
  await userEvent.click(screen.getByRole("button", { name: "Side by side" }));
  expect(screen.getByRole("heading", { name: "After Proposed source" })).toBeTruthy();
});

test.each([
  ["changed source", before.replace("eval", "other"), patch],
  ["wrong target file", before, patch.replaceAll("index.js", "other.js")],
  ["invalid diff", before, "not a patch"],
  ["multiple files", before, patch + createTwoFilesPatch("a/other.js", "b/other.js", "a\n", "b\n")],
])("does not invent after source for %s", (_, source, proposal) => {
  render(<PatchComparison filename="index.js" originalCode={source} patch={proposal} />);
  expect(screen.getByRole("status").textContent).toContain("could not be matched exactly");
  expect(screen.getByRole("button", { name: "Side by side" }).disabled).toBe(true);
  expect(screen.getByRole("region").querySelector("code").textContent).toBe(proposal);
});

test("aligns insertions, deletions and distant hunks without dropping whitespace or the final line", () => {
  const source = "  first\nremove\n" + "context\n".repeat(15) + "last";
  const proposed = "  first\n" + "context\n".repeat(15) + "added\nlast";
  render(<PatchComparison filename="source" originalCode={source}
    patch={createTwoFilesPatch("a/source", "b/source", source, proposed)} />);
  const codes = [...screen.getByRole("region").querySelectorAll("code")].map(node => node.textContent);
  expect(codes.filter(value => value === "  first")).toHaveLength(2);
  expect(codes.filter(value => value === "last")).toHaveLength(2);
  expect(codes).toContain("remove");
  expect(codes).toContain("added");
});

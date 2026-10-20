import React from "react";
import { test, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScanModal } from "./ScanModal";
afterEach(cleanup);
test("dialog focuses its close control and supports Escape", async () => {
  const onClose = vi.fn(); render(<ScanModal isOpen onClose={onClose} />);
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close dialog" }));
  await userEvent.keyboard("{Escape}"); expect(onClose).toHaveBeenCalledTimes(1);
});

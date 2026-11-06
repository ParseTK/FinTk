import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PalettePicker } from "./PalettePicker";
import { STORAGE_KEYS } from "./options";

function stubMatchMedia(reducedMotion: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reducedMotion && query.includes("prefers-reduced-motion"),
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete (document as unknown as Record<string, unknown>).startViewTransition;
  localStorage.clear();
  const root = document.documentElement;
  root.classList.remove("dark");
  delete root.dataset.accent;
  delete root.dataset.font;
  delete root.dataset.motion;
});

describe("PalettePicker view transition", () => {
  it("cross-fades a change when the browser supports it", async () => {
    stubMatchMedia(false);
    const start = vi.fn((callback: () => void) => callback());
    (document as unknown as Record<string, unknown>).startViewTransition = start;
    const user = userEvent.setup();
    render(<PalettePicker />);
    await user.click(screen.getByRole("button", { name: "Appearance" }));

    await user.click(screen.getByRole("button", { name: "Dark" }));

    expect(start).toHaveBeenCalledTimes(1);
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem(STORAGE_KEYS.mode)).toBe("dark");
  });

  it("still applies the change, without a transition, under reduced motion", async () => {
    stubMatchMedia(true);
    const start = vi.fn();
    (document as unknown as Record<string, unknown>).startViewTransition = start;
    const user = userEvent.setup();
    render(<PalettePicker />);
    await user.click(screen.getByRole("button", { name: "Appearance" }));

    await user.click(screen.getByRole("button", { name: "Dark" }));

    expect(start).not.toHaveBeenCalled();
    expect(document.documentElement).toHaveClass("dark");
  });
});

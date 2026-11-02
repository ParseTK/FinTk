import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "@/lib/preferences";
import { PalettePicker } from "./PalettePicker";

afterEach(() => {
  localStorage.clear();
  const root = document.documentElement;
  root.classList.remove("dark");
  delete root.dataset.accent;
  delete root.dataset.font;
});

const openButton = () => screen.getByRole("button", { name: "Appearance" });

describe("PalettePicker", () => {
  it("starts closed and exposes its state on the button", async () => {
    const user = userEvent.setup();
    render(<PalettePicker />);

    expect(openButton()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("group", { name: "Mode" })).not.toBeInTheDocument();

    await user.click(openButton());

    expect(openButton()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("group", { name: "Mode" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Accent" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Typeface" })).toBeInTheDocument();
  });

  it("offers only Light and Dark for mode", async () => {
    const user = userEvent.setup();
    render(<PalettePicker />);
    await user.click(openButton());

    expect(screen.getByRole("button", { name: "Light" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dark" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "System" })).not.toBeInTheDocument();
  });

  it("starts in the device's mode: Dark when the device prefers dark", async () => {
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    const user = userEvent.setup();
    render(<PalettePicker />);
    await user.click(openButton());

    expect(screen.getByRole("button", { name: "Dark", pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Light", pressed: false })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("defaults to Light (device default here), Blue and Inter", async () => {
    const user = userEvent.setup();
    render(<PalettePicker />);
    await user.click(openButton());

    expect(screen.getByRole("button", { name: "Light", pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Blue/, pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Inter/, pressed: true })).toBeInTheDocument();
  });

  it("applies and saves mode, accent and typeface", async () => {
    const user = userEvent.setup();
    render(<PalettePicker />);
    await user.click(openButton());

    await user.click(screen.getByRole("button", { name: "Dark" }));
    await user.click(screen.getByRole("button", { name: /Violet/ }));
    await user.click(screen.getByRole("button", { name: /IBM Plex Sans/ }));

    const root = document.documentElement;
    expect(root).toHaveClass("dark");
    expect(root.dataset.accent).toBe("violet");
    expect(root.dataset.font).toBe("plex");
    expect(localStorage.getItem(STORAGE_KEYS.mode)).toBe("dark");
    expect(localStorage.getItem(STORAGE_KEYS.accent)).toBe("violet");
    expect(localStorage.getItem(STORAGE_KEYS.font)).toBe("plex");
    expect(screen.getByRole("button", { name: /Violet/, pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Blue/, pressed: false })).toBeInTheDocument();
  });

  it("closes on Escape and returns focus to the button", async () => {
    const user = userEvent.setup();
    render(<PalettePicker />);
    await user.click(openButton());
    await user.click(screen.getByRole("button", { name: "Light" }));

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("group", { name: "Mode" })).not.toBeInTheDocument();
    expect(openButton()).toHaveFocus();
  });

  it("closes when clicking outside", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">elsewhere</button>
        <PalettePicker />
      </>,
    );
    await user.click(openButton());
    await user.click(screen.getByRole("button", { name: "elsewhere" }));

    expect(screen.queryByRole("group", { name: "Mode" })).not.toBeInTheDocument();
  });

  it("closes when keyboard focus leaves the panel", async () => {
    const user = userEvent.setup();
    render(
      <>
        <PalettePicker />
        <button type="button">after</button>
      </>,
    );
    await user.click(openButton());
    await act(async () => screen.getByRole("button", { name: "after" }).focus());

    expect(screen.queryByRole("group", { name: "Mode" })).not.toBeInTheDocument();
  });
});

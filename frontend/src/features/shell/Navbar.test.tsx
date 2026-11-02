import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Navbar } from "./Navbar";

afterEach(() => vi.unstubAllEnvs());

describe("Navbar", () => {
  it("links the Virello logo home with an accessible name", () => {
    render(<Navbar />);
    expect(screen.getByRole("link", { name: "Virello home" })).toHaveAttribute("href", "/");
  });

  it("links to search", () => {
    render(<Navbar />);
    expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute("href", "/search");
  });
});

describe("Navbar palette flag", () => {
  it("shows the palette button by default", () => {
    render(<Navbar />);
    expect(screen.getByRole("button", { name: "Appearance" })).toBeInTheDocument();
  });

  it("hides only the palette when off; the rest of the nav still works", () => {
    vi.stubEnv("FEATURE_PALETTE", "false");
    render(<Navbar />);
    expect(screen.queryByRole("button", { name: "Appearance" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Virello home" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Search" })).toBeInTheDocument();
  });
});

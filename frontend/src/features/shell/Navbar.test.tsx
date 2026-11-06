import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Navbar } from "./Navbar";

afterEach(() => vi.unstubAllEnvs());

describe("Navbar", () => {
  it("links the FinTk logo home with an accessible name", () => {
    render(<Navbar />);
    expect(screen.getByRole("link", { name: "FinTk home" })).toHaveAttribute("href", "/");
  });

  it("has no section links while the crypto pages are off, so there is never a dead link", () => {
    render(<Navbar />);
    expect(screen.queryByRole("link", { name: "Crypto" })).not.toBeInTheDocument();
  });

  it("has one Crypto link to the crypto pages, and none of the section's own pages", () => {
    vi.stubEnv("FEATURE_CRYPTO", "true");
    vi.stubEnv("FEATURE_CRYPTO_NEWS", "true");
    render(<Navbar />);
    expect(screen.getAllByRole("link", { name: "Crypto" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Crypto" })).toHaveAttribute("href", "/crypto");
    // The pages of the section belong to the sidebar, not the header.
    expect(screen.queryByRole("link", { name: /news/i })).not.toBeInTheDocument();
  });

  it("has no Crypto | Stocks switch any more", () => {
    vi.stubEnv("FEATURE_CRYPTO", "true");
    render(<Navbar />);
    expect(screen.queryByRole("group", { name: "Show" })).not.toBeInTheDocument();
  });
});

describe("Navbar palette flag", () => {
  it("shows the palette button by default", () => {
    render(<Navbar />);
    expect(screen.getByRole("button", { name: "Appearance" })).toBeInTheDocument();
  });

  it("hides only the palette when off; the rest of the nav still works", () => {
    vi.stubEnv("FEATURE_PALETTE", "false");
    vi.stubEnv("FEATURE_CRYPTO", "true");
    render(<Navbar />);
    expect(screen.queryByRole("button", { name: "Appearance" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "FinTk home" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Crypto" })).toBeInTheDocument();
  });
});

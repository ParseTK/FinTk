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

describe("Navbar markets flag", () => {
  it("has no Markets link while the flag is off, so there is never a dead link", () => {
    render(<Navbar />);
    expect(screen.queryByRole("link", { name: "Markets" })).not.toBeInTheDocument();
  });

  it("links to Markets when the flag is on", () => {
    vi.stubEnv("FEATURE_MARKETS", "true");
    render(<Navbar />);
    expect(screen.getByRole("link", { name: "Markets" })).toHaveAttribute("href", "/markets");
  });
});

describe("Navbar with several flagged pages", () => {
  it("moves the links into the phone menu once there are more than two", () => {
    vi.stubEnv("FEATURE_MARKETS", "true");
    vi.stubEnv("FEATURE_NEWS", "true");
    render(<Navbar />);
    expect(screen.getByRole("button", { name: "Menu" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "News" })[0]).toHaveAttribute("href", "/news");
  });

  it("has no News link and no menu while its flag is off", () => {
    render(<Navbar />);
    expect(screen.queryByRole("link", { name: "News" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Menu" })).not.toBeInTheDocument();
  });
});

describe("Navbar with the Crypto | Stocks switch", () => {
  it("shows no switch and every link when no mode is given", () => {
    vi.stubEnv("FEATURE_CRYPTO", "true");
    render(<Navbar />);
    expect(screen.queryByRole("group", { name: "Show" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Search" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Crypto" })).toBeInTheDocument();
  });

  it("shows the switch and only the crypto links in Crypto mode", () => {
    vi.stubEnv("FEATURE_CRYPTO", "true");
    render(<Navbar mode="crypto" />);
    const group = screen.getByRole("group", { name: "Show" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crypto" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("link", { name: "Crypto" })).toHaveAttribute("href", "/crypto");
    expect(screen.queryByRole("link", { name: "Search" })).not.toBeInTheDocument();
  });

  it("shows the switch and the research links in Stocks mode", () => {
    vi.stubEnv("FEATURE_CRYPTO", "true");
    render(<Navbar mode="stocks" />);
    expect(screen.getByRole("button", { name: "Stocks" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute("href", "/search");
    expect(screen.queryByRole("link", { name: "Crypto" })).not.toBeInTheDocument();
  });

  it("keeps the logo and the appearance button in both modes", () => {
    for (const mode of ["crypto", "stocks"] as const) {
      const { unmount } = render(<Navbar mode={mode} />);
      expect(screen.getByRole("link", { name: "Virello home" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Appearance" })).toBeInTheDocument();
      unmount();
    }
  });
});

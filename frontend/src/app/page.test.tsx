import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import HomePage from "./page";

afterEach(() => vi.unstubAllEnvs());

describe("home page", () => {
  it("shows the hero, the sample ticker and the feature cards", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /sample market snapshot/i })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Built for looking deeper" }),
    ).toBeInTheDocument();
  });

  it("places the sample ticker above the hero", () => {
    render(<HomePage />);
    const ticker = screen.getByRole("region", { name: /sample market snapshot/i });
    const hero = screen.getByRole("heading", { level: 1 });
    // DOCUMENT_POSITION_FOLLOWING (4): the hero comes after the ticker in the document.
    expect(ticker.compareDocumentPosition(hero) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("removes only the ticker when the market_ticker flag is off", () => {
    vi.stubEnv("FEATURE_MARKET_TICKER", "false");
    render(<HomePage />);
    expect(
      screen.queryByRole("region", { name: /sample market snapshot/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Built for looking deeper" }),
    ).toBeInTheDocument();
  });
});

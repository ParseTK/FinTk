import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PortfolioProvider } from "@/features/portfolio";
import { CompanyCard } from "./CompanyCard";
import { SearchForm } from "./SearchForm";

function stubMatchMedia(reducedMotion: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reducedMotion && query.includes("prefers-reduced-motion"),
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.motion;
});

const input = () => screen.getByRole("searchbox");

// Each step schedules the next one only after React re-renders, so advance one tick at a time.
function stepThroughAll(steps = 5) {
  for (let i = 0; i < steps; i++) act(() => vi.advanceTimersByTime(3500));
}

describe("SearchForm rotating placeholder", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stubMatchMedia(false);
  });

  it("starts on the default hint and moves through examples", () => {
    render(<SearchForm />);
    expect(input()).toHaveAttribute("placeholder", "Search companies or tickers");

    act(() => vi.advanceTimersByTime(3500));
    expect(input()).toHaveAttribute("placeholder", "Try Apple");

    act(() => vi.advanceTimersByTime(3500));
    expect(input()).toHaveAttribute("placeholder", "Try NVDA");
  });

  it("plays through once, then settles back on the default and stays there", () => {
    render(<SearchForm />);
    stepThroughAll();
    expect(input()).toHaveAttribute("placeholder", "Search companies or tickers");

    stepThroughAll();
    expect(input()).toHaveAttribute("placeholder", "Search companies or tickers");
  });

  it("stops while the field is focused", () => {
    render(<SearchForm />);
    act(() => input().focus());
    act(() => vi.advanceTimersByTime(3500 * 3));
    expect(input()).toHaveAttribute("placeholder", "Search companies or tickers");
  });

  it("does not rotate when the field has text", () => {
    render(<SearchForm defaultValue="apple" />);
    act(() => vi.advanceTimersByTime(3500 * 3));
    expect(input()).toHaveAttribute("placeholder", "Search companies or tickers");
  });

  it("never rotates under reduced motion", () => {
    stubMatchMedia(true);
    render(<SearchForm />);
    act(() => vi.advanceTimersByTime(3500 * 3));
    expect(input()).toHaveAttribute("placeholder", "Search companies or tickers");
  });

  it("keeps a constant accessible label while the placeholder changes", () => {
    render(<SearchForm />);
    act(() => vi.advanceTimersByTime(3500));
    expect(screen.getByRole("searchbox", { name: "Search companies" })).toBeInTheDocument();
  });
});

describe("result card entrance", () => {
  it("staggers list entrances with a capped delay", () => {
    const company = {
      symbol: "AAPL",
      name: "Apple Inc.",
      currency: "USD",
      exchange: "NASDAQ",
      exchangeFullName: "NASDAQ Global Select",
    };
    render(
      <PortfolioProvider>
        <ul>
          <CompanyCard company={company} index={2} />
          <CompanyCard company={{ ...company, symbol: "MSFT" }} index={99} />
        </ul>
      </PortfolioProvider>,
    );
    const [first, second] = screen.getAllByRole("listitem");
    expect(first).toHaveClass("animate-fade-up");
    expect(first).toHaveStyle({ animationDelay: "100ms" });
    expect(second).toHaveStyle({ animationDelay: "400ms" });
  });
});

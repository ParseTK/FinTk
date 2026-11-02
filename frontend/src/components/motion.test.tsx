import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "@/lib/preferences";
import { CompanyCard } from "./CompanyCard";
import { PalettePicker } from "./PalettePicker";
import { PortfolioProvider } from "./portfolio/PortfolioProvider";
import { SearchForm } from "./SearchForm";
import { Button } from "./ui/Button";
import { Skeleton } from "./ui/Skeleton";

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
  delete (document as unknown as Record<string, unknown>).startViewTransition;
  localStorage.clear();
  const root = document.documentElement;
  root.classList.remove("dark");
  delete root.dataset.accent;
  delete root.dataset.font;
  delete root.dataset.motion;
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

describe("micro-interaction styles", () => {
  it("only applies press and lift transforms when motion is allowed", () => {
    render(<Button>Go</Button>);
    const classes = screen.getByRole("button", { name: "Go" }).className;
    expect(classes).toContain("motion-safe:enabled:active:scale-");
    expect(classes).toContain("motion-safe:enabled:hover:-translate-y-px");
    expect(classes).not.toMatch(/(^|\s)(active|hover):(scale|-translate)/);
  });

  it("shimmers skeletons and hides them from assistive tech", () => {
    const { container } = render(<Skeleton className="h-4" />);
    expect(container.firstChild).toHaveClass("animate-shimmer");
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });

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

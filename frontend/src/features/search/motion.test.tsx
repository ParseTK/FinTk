import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PortfolioProvider } from "@/features/portfolio";
import { CompanyCard } from "./CompanyCard";
import { SearchForm } from "./SearchForm";
import {
  PLACEHOLDER_FALLBACK,
  PLACEHOLDER_PREFIX,
  PLACEHOLDER_WORDS,
  pickWordIndex,
} from "./useTypewriterPlaceholder";

function stubMatchMedia(reducedMotion: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reducedMotion && query.includes("prefers-reduced-motion"),
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.motion;
});

const input = () => screen.getByRole("searchbox");
const placeholder = () => input().getAttribute("placeholder");
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

/**
 * Timeline with a first random pick of "Apple": start delay 1200ms, then the prefix, a 400ms gap,
 * one letter per 80ms, a 1700ms hold, then one letter deleted per 40ms.
 */
describe("SearchForm typewriter placeholder", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stubMatchMedia(false);
    vi.spyOn(Math, "random").mockReturnValue(0); // always the first allowed word
  });

  it("starts on the plain hint, then types the prefix", () => {
    render(<SearchForm />);
    expect(placeholder()).toBe(PLACEHOLDER_FALLBACK);

    advance(3500);
    expect(placeholder()).toBe(PLACEHOLDER_PREFIX);
  });

  it("types a company name one letter at a time", () => {
    render(<SearchForm />);
    advance(3500 + 400);
    expect(placeholder()).toBe(PLACEHOLDER_PREFIX + "A");

    advance(80);
    expect(placeholder()).toBe(PLACEHOLDER_PREFIX + "Ap");

    advance(80 * 3);
    expect(placeholder()).toBe(PLACEHOLDER_PREFIX + "Apple");
  });

  it("holds the finished word, then deletes it letter by letter", () => {
    render(<SearchForm />);
    advance(3500 + 400 + 80 * 4); // "Apple" fully typed
    advance(1000);
    expect(placeholder()).toBe(PLACEHOLDER_PREFIX + "Apple"); // still holding

    advance(700); // hold over, first letter deleted
    expect(placeholder()).toBe(PLACEHOLDER_PREFIX + "Appl");

    advance(40 * 4); // the remaining four
    expect(placeholder()).toBe(PLACEHOLDER_PREFIX);
  });

  it("moves on to a different word and keeps looping", () => {
    render(<SearchForm />);
    advance(3500 + 400 + 80 * 4 + 1700 + 40 * 5 + 400 + 80); // Apple done, Tesla typing
    expect(placeholder()).toBe(PLACEHOLDER_PREFIX + "Te");
  });

  it("loops indefinitely through many different names", () => {
    const sequence = [0, 0.5, 0.9, 0.2, 0.7, 0.35, 0.8, 0.1];
    let call = 0;
    vi.spyOn(Math, "random").mockImplementation(() => sequence[call++ % sequence.length]!);

    render(<SearchForm />);
    const seen = new Set<string>();
    for (let elapsed = 0; elapsed < 90_000; elapsed += 100) {
      advance(100);
      const text = placeholder() ?? "";
      const word = PLACEHOLDER_WORDS.find((w) => text === PLACEHOLDER_PREFIX + w);
      if (word) seen.add(word);
    }
    expect(seen.size).toBeGreaterThanOrEqual(5);
    expect(placeholder()?.startsWith(PLACEHOLDER_PREFIX)).toBe(true);
  });

  it("stops on the plain hint while the field is focused, and restarts when it is left", () => {
    render(<SearchForm />);
    advance(3500 + 400 + 80 * 2);
    expect(placeholder()).toBe(PLACEHOLDER_PREFIX + "App");

    act(() => input().focus());
    expect(placeholder()).toBe(PLACEHOLDER_FALLBACK);
    advance(10_000);
    expect(placeholder()).toBe(PLACEHOLDER_FALLBACK);

    act(() => input().blur());
    advance(3500);
    expect(placeholder()).toBe(PLACEHOLDER_PREFIX);
  });

  it("does not animate when the field already has text", () => {
    render(<SearchForm defaultValue="apple" />);
    advance(20_000);
    expect(placeholder()).toBe(PLACEHOLDER_FALLBACK);
  });

  it("never animates under reduced motion", () => {
    stubMatchMedia(true);
    render(<SearchForm />);
    advance(20_000);
    expect(placeholder()).toBe(PLACEHOLDER_FALLBACK);
  });

  it("the Motion setting beats a full-motion device, and stops a running animation", () => {
    document.documentElement.dataset.motion = "reduced";
    render(<SearchForm />);
    advance(20_000);
    expect(placeholder()).toBe(PLACEHOLDER_FALLBACK);
  });

  it("stops mid-run when Motion is switched to Reduced", () => {
    document.documentElement.dataset.motion = "full";
    render(<SearchForm />);
    advance(3500 + 400 + 80 * 2);
    expect(placeholder()).toBe(PLACEHOLDER_PREFIX + "App");

    document.documentElement.dataset.motion = "reduced";
    advance(200);
    expect(placeholder()).toBe(PLACEHOLDER_FALLBACK);
    advance(20_000);
    expect(placeholder()).toBe(PLACEHOLDER_FALLBACK);
  });

  it("keeps a constant accessible label while the placeholder changes", () => {
    render(<SearchForm />);
    advance(3500 + 400 + 80 * 3);
    expect(screen.getByRole("searchbox", { name: "Search companies" })).toBeInTheDocument();
  });
});

describe("pickWordIndex", () => {
  it("never repeats the previous word, whatever the random value", () => {
    for (let previous = -1; previous < PLACEHOLDER_WORDS.length; previous++) {
      for (let r = 0; r < 1; r += 0.05) {
        expect(pickWordIndex(previous, () => r)).not.toBe(previous);
      }
    }
  });

  it("can reach every word", () => {
    const reached = new Set<number>();
    for (let r = 0; r < 1; r += 0.01) reached.add(pickWordIndex(-1, () => r));
    expect(reached.size).toBe(PLACEHOLDER_WORDS.length);
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

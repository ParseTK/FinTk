import { describe, expect, it } from "vitest";
import {
  defaultSort,
  filterHoldings,
  PAGE_SIZE,
  sortHoldings,
  sortOptions,
  TOOLBAR_MIN,
} from "./holdingsView";
import type { Holding } from "./types";

const holding = (
  symbol: string,
  name: string | null,
  cost: string,
  priced?: { value: string; gain: string; percent: string },
): Holding => ({
  symbol,
  name,
  shares: "1.000000",
  average_cost: cost,
  cost_basis: cost,
  lots: 1,
  valuation: priced
    ? {
        price: priced.value,
        as_of: "2026-10-31",
        market_value: priced.value,
        gain: priced.gain,
        gain_percent: priced.percent,
      }
    : null,
});

const all = [
  holding("KO", "COCA COLA CO", "500.00", { value: "900.00", gain: "400.00", percent: "80.00" }),
  holding("AAPL", "Apple Inc.", "1000.00", {
    value: "3000.00",
    gain: "2000.00",
    percent: "200.00",
  }),
  holding("XOM", "ExxonMobil Holdings Corp", "300.00", {
    value: "250.00",
    gain: "-50.00",
    percent: "-16.67",
  }),
  holding("PG", "PROCTER & GAMBLE Co", "800.00"), // no price
];

const symbols = (list: Holding[]) => list.map((h) => h.symbol);

describe("filterHoldings", () => {
  it("keeps everything for an empty or blank query", () => {
    expect(filterHoldings(all, "")).toBe(all);
    expect(filterHoldings(all, "   ")).toBe(all);
  });

  it("matches a ticker or a name, ignoring case", () => {
    expect(symbols(filterHoldings(all, "aapl"))).toEqual(["AAPL"]);
    expect(symbols(filterHoldings(all, "EXXON"))).toEqual(["XOM"]);
    expect(symbols(filterHoldings(all, "gamble"))).toEqual(["PG"]);
  });

  it("matches the middle of a word, not only the start", () => {
    expect(symbols(filterHoldings(all, "ola"))).toEqual(["KO"]);
  });

  it("needs every word to match, so more words narrow the result", () => {
    expect(symbols(filterHoldings(all, "coca cola"))).toEqual(["KO"]);
    expect(filterHoldings(all, "coca apple")).toEqual([]);
  });

  it("copes with a holding that has no name", () => {
    expect(symbols(filterHoldings([holding("ZZZ", null, "1.00")], "zz"))).toEqual(["ZZZ"]);
  });

  it("finds nothing for a query that matches nothing", () => {
    expect(filterHoldings(all, "qqqq")).toEqual([]);
  });
});

describe("sortHoldings", () => {
  it("puts the largest value first, and holdings without a price last", () => {
    expect(symbols(sortHoldings(all, "value"))).toEqual(["AAPL", "KO", "XOM", "PG"]);
  });

  it("orders by gain, best return and worst return", () => {
    expect(symbols(sortHoldings(all, "gain"))).toEqual(["AAPL", "KO", "XOM", "PG"]);
    expect(symbols(sortHoldings(all, "return"))).toEqual(["AAPL", "KO", "XOM", "PG"]);
    expect(symbols(sortHoldings(all, "worst"))).toEqual(["XOM", "KO", "AAPL", "PG"]);
  });

  it("orders by what was paid, which every holding has", () => {
    expect(symbols(sortHoldings(all, "paid"))).toEqual(["AAPL", "PG", "KO", "XOM"]);
  });

  it("orders by ticker", () => {
    expect(symbols(sortHoldings(all, "symbol"))).toEqual(["AAPL", "KO", "PG", "XOM"]);
  });

  it("never changes the list it was given", () => {
    const before = symbols(all);
    sortHoldings(all, "symbol");
    expect(symbols(all)).toEqual(before);
  });

  it("breaks ties by ticker so the order is always the same", () => {
    const tied = [holding("B", null, "100.00"), holding("A", null, "100.00")];
    expect(symbols(sortHoldings(tied, "paid"))).toEqual(["A", "B"]);
  });

  it("handles a few hundred holdings quickly", () => {
    const many = Array.from({ length: 500 }, (_, i) =>
      holding(`S${i}`, null, `${(i * 37) % 1000}.00`),
    );
    const started = performance.now();
    sortHoldings(filterHoldings(many, "s"), "paid");
    expect(performance.now() - started).toBeLessThan(100);
  });
});

describe("options", () => {
  it("offers value-based orderings only when there are prices", () => {
    expect(sortOptions(true).map((o) => o.key)).toContain("value");
    expect(sortOptions(false).map((o) => o.key)).toEqual(["paid", "symbol"]);
  });

  it("starts with the biggest holding first", () => {
    expect(defaultSort(true)).toBe("value");
    expect(defaultSort(false)).toBe("paid");
  });

  it("keeps the page size and the toolbar threshold sensible", () => {
    expect(PAGE_SIZE).toBeGreaterThanOrEqual(10);
    expect(TOOLBAR_MIN).toBeGreaterThan(3);
  });
});

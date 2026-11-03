import type { Holding } from "./types";

/** How many holdings are drawn at first, and added by each "Show more". Keeps the page light. */
export const PAGE_SIZE = 25;

/** A portfolio this small does not need searching; the toolbar would only be clutter. */
export const TOOLBAR_MIN = 8;

export type SortKey = "value" | "gain" | "return" | "worst" | "paid" | "symbol";

export interface SortOption {
  key: SortKey;
  label: string;
}

/** Which orderings make sense: those about value only exist once prices do. */
export function sortOptions(valued: boolean): SortOption[] {
  return valued
    ? [
        { key: "value", label: "Largest value" },
        { key: "gain", label: "Biggest gain" },
        { key: "return", label: "Best return" },
        { key: "worst", label: "Worst return" },
        { key: "paid", label: "Most paid" },
        { key: "symbol", label: "Ticker A to Z" },
      ]
    : [
        { key: "paid", label: "Most paid" },
        { key: "symbol", label: "Ticker A to Z" },
      ];
}

export const defaultSort = (valued: boolean): SortKey => (valued ? "value" : "paid");

/**
 * Holdings whose ticker or name contains every word of the query, ignoring case. An empty query
 * keeps everything. Several words narrow the result ("coca cola" finds Coca Cola, not Coca).
 */
export function filterHoldings(holdings: Holding[], query: string): Holding[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return holdings;
  return holdings.filter((holding) => {
    const haystack = `${holding.symbol} ${holding.name ?? ""}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

// Numbers here only decide an order. What is shown always comes from the exact strings.
const num = (value: string | undefined): number => (value === undefined ? NaN : Number(value));

/** The number a sort looks at, or NaN when the holding has none (then it goes last). */
function measure(holding: Holding, key: SortKey): number {
  const v = holding.valuation;
  switch (key) {
    case "value":
      return num(v?.market_value);
    case "gain":
      return num(v?.gain);
    case "return":
    case "worst":
      return num(v?.gain_percent);
    case "paid":
      return num(holding.cost_basis);
    case "symbol":
      return 0;
  }
}

/** A new, ordered list. Holdings without the measured number go last; ties fall back to the ticker. */
export function sortHoldings(holdings: Holding[], key: SortKey): Holding[] {
  const direction = key === "worst" ? 1 : -1; // "worst return" is lowest first; the rest highest first
  return [...holdings].sort((a, b) => {
    if (key !== "symbol") {
      const x = measure(a, key);
      const y = measure(b, key);
      const xMissing = Number.isNaN(x);
      const yMissing = Number.isNaN(y);
      if (xMissing !== yMissing) return xMissing ? 1 : -1;
      if (!xMissing && x !== y) return x < y ? -direction : direction;
    }
    return a.symbol.localeCompare(b.symbol);
  });
}

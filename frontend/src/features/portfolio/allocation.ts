import type { Holding } from "./types";

/** How many companies get their own slice; the rest are grouped as "Other". */
export const MAX_SLICES = 5;

export interface Slice {
  key: string;
  label: string;
  /** The company this slice is, or null for the grouped "Other". */
  symbol: string | null;
  /** Money as a decimal string with two places, exact (summed in cents, never as floats). */
  amount: string;
  /** 0 to 1. For drawing and for showing a percentage only. */
  share: number;
}

export interface Allocation {
  /** What the split is by: current value only when every holding has a price, else amount paid. */
  basis: "value" | "paid";
  total: string;
  slices: Slice[];
}

/** "1234.5" or "1234.56" to whole cents, exactly. Anything unreadable counts as zero. */
export function toCents(value: string): bigint {
  const match = /^(-?)(\d+)(?:\.(\d*))?$/.exec(value.trim());
  if (!match) return 0n;
  const [, sign, whole, fraction = ""] = match;
  const cents = BigInt(whole! + fraction.padEnd(2, "0").slice(0, 2));
  return sign ? -cents : cents;
}

export function fromCents(cents: bigint): string {
  const negative = cents < 0n;
  const absolute = negative ? -cents : cents;
  const text = absolute.toString().padStart(3, "0");
  return `${negative ? "-" : ""}${text.slice(0, -2)}.${text.slice(-2)}`;
}

/**
 * Splits a portfolio into slices by size, largest first. By current value when every holding has
 * a price (a split that mixes priced and unpriced holdings would be misleading), otherwise by
 * what was paid. Holdings worth nothing are left out; past MAX_SLICES the smallest are grouped.
 */
export function computeAllocation(holdings: Holding[]): Allocation | null {
  const everyHoldingPriced = holdings.length > 0 && holdings.every((h) => h.valuation);
  const basis = everyHoldingPriced ? "value" : "paid";
  const items = holdings
    .map((holding) => ({
      holding,
      cents: toCents(
        basis === "value" ? (holding.valuation?.market_value ?? "0") : holding.cost_basis,
      ),
    }))
    .filter((item) => item.cents > 0n)
    .sort((a, b) => (a.cents === b.cents ? 0 : a.cents > b.cents ? -1 : 1));
  if (items.length === 0) return null;

  const total = items.reduce((sum, item) => sum + item.cents, 0n);
  const shareOf = (cents: bigint) => Number((cents * 1_000_000n) / total) / 1_000_000;

  const grouping = items.length > MAX_SLICES + 1;
  const shown = grouping ? items.slice(0, MAX_SLICES) : items;
  const slices: Slice[] = shown.map(({ holding, cents }) => ({
    key: holding.symbol,
    label: holding.symbol,
    symbol: holding.symbol,
    amount: fromCents(cents),
    share: shareOf(cents),
  }));
  if (grouping) {
    const rest = items.slice(MAX_SLICES);
    const cents = rest.reduce((sum, item) => sum + item.cents, 0n);
    slices.push({
      key: "other",
      label: `Other (${rest.length})`,
      symbol: null,
      amount: fromCents(cents),
      share: shareOf(cents),
    });
  }
  return { basis, total: fromCents(total), slices };
}

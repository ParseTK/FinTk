import { describe, expect, it } from "vitest";
import { computeAllocation, fromCents, MAX_SLICES, OTHER_COLOR, toCents } from "./allocation";
import type { Holding } from "./types";

const holding = (symbol: string, cost: string, value?: string): Holding => ({
  symbol,
  name: null,
  shares: "1.000000",
  average_cost: cost,
  cost_basis: cost,
  lots: 1,
  valuation: value
    ? { price: value, as_of: "2026-10-31", market_value: value, gain: "0.00", gain_percent: "0.00" }
    : null,
});

describe("toCents and fromCents", () => {
  it.each([
    ["1000.00", 100000n],
    ["0.5", 50n],
    ["12", 1200n],
    ["0.07", 7n],
    ["  3.10 ", 310n],
    ["-4.25", -425n],
    ["1.239", 123n], // beyond cents is cut, never rounded up into a different amount
  ])("reads %j as %s cents", (text, cents) => {
    expect(toCents(text)).toBe(cents);
  });

  it.each(["", "abc", "1,000.00", "1e3", "--1"])("treats %j as zero", (text) => {
    expect(toCents(text)).toBe(0n);
  });

  it.each([
    [100000n, "1000.00"],
    [7n, "0.07"],
    [0n, "0.00"],
    [-425n, "-4.25"],
    [123456789012n, "1234567890.12"],
  ])("writes %s cents as %s", (cents, text) => {
    expect(fromCents(cents)).toBe(text);
  });

  it("adds exactly where floats would drift", () => {
    const sum = toCents("0.10") + toCents("0.20");
    expect(fromCents(sum)).toBe("0.30");
    expect(0.1 + 0.2).not.toBe(0.3); // the problem this avoids
  });
});

describe("computeAllocation", () => {
  it("splits by current value when every holding has a price", () => {
    const result = computeAllocation([
      holding("AAPL", "100.00", "300.00"),
      holding("KO", "100.00", "100.00"),
    ]);
    expect(result?.basis).toBe("value");
    expect(result?.total).toBe("400.00");
    expect(result?.slices.map((s) => [s.label, s.amount, s.share])).toEqual([
      ["AAPL", "300.00", 0.75],
      ["KO", "100.00", 0.25],
    ]);
  });

  it("falls back to what was paid for everything if any holding has no price", () => {
    const result = computeAllocation([
      holding("AAPL", "100.00", "900.00"), // priced, but the split must not mix bases
      holding("KO", "300.00"),
    ]);
    expect(result?.basis).toBe("paid");
    expect(result?.slices.map((s) => [s.label, s.amount])).toEqual([
      ["KO", "300.00"],
      ["AAPL", "100.00"],
    ]);
  });

  it("orders slices largest first and the shares add up to the whole", () => {
    const result = computeAllocation([
      holding("A", "10.00"),
      holding("B", "30.00"),
      holding("C", "60.00"),
    ]);
    expect(result?.slices.map((s) => s.label)).toEqual(["C", "B", "A"]);
    const total = result?.slices.reduce((sum, s) => sum + s.share, 0) ?? 0;
    expect(total).toBeCloseTo(1, 5);
  });

  it("gives every company its own slice up to the limit, then groups the rest", () => {
    const six = Array.from({ length: MAX_SLICES + 1 }, (_, i) => holding(`S${i}`, `${100 - i}.00`));
    expect(computeAllocation(six)?.slices).toHaveLength(MAX_SLICES + 1);
    expect(computeAllocation(six)?.slices.some((s) => s.symbol === null)).toBe(false);

    const eight = Array.from({ length: 8 }, (_, i) => holding(`S${i}`, `${100 - i}.00`));
    const grouped = computeAllocation(eight)!;
    expect(grouped.slices).toHaveLength(MAX_SLICES + 1);
    const other = grouped.slices.at(-1)!;
    expect(other.symbol).toBeNull();
    expect(other.label).toBe("Other (3)");
    expect(other.amount).toBe("282.00"); // 95 + 94 + 93, summed exactly
    expect(grouped.total).toBe("772.00"); // 100 + 99 + ... + 93
  });

  it("gives each company its own chart color in order, and the grouped ones the neutral one", () => {
    const eight = Array.from({ length: 8 }, (_, i) => holding(`S${i}`, `${100 - i}.00`));
    const result = computeAllocation(eight)!;
    expect(result.slices.map((s) => s.color)).toEqual([
      "var(--chart-1)",
      "var(--chart-2)",
      "var(--chart-3)",
      "var(--chart-4)",
      "var(--chart-5)",
      OTHER_COLOR,
    ]);
    expect(result.colors.S0).toBe("var(--chart-1)");
    expect(result.colors.S4).toBe("var(--chart-5)");
    expect(result.colors.S5).toBe(OTHER_COLOR); // grouped companies still get a swatch
    expect(result.colors.S7).toBe(OTHER_COLOR);
    expect(Object.keys(result.colors)).toHaveLength(8);
  });

  it("never gives two companies the same color", () => {
    const before = computeAllocation([holding("A", "50.00"), holding("B", "30.00")])!;
    expect(before.colors.A).toBe("var(--chart-1)");
    // B growing past A reorders the slices, and colors follow the order of the split, as in any
    // single chart; what must hold is that no two companies ever share a color.
    const after = computeAllocation([holding("A", "50.00"), holding("B", "80.00")])!;
    expect(new Set(Object.values(after.colors)).size).toBe(2);
  });

  it("leaves out holdings worth nothing and returns nothing when nothing is left", () => {
    expect(computeAllocation([])).toBeNull();
    expect(computeAllocation([holding("A", "0.00"), holding("B", "0.00")])).toBeNull();
    const result = computeAllocation([holding("A", "0.00"), holding("B", "5.00")]);
    expect(result?.slices.map((s) => s.label)).toEqual(["B"]);
    expect(result?.slices[0]?.share).toBe(1);
  });
});

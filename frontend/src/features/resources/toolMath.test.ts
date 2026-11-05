import { describe, expect, it } from "vitest";
import { breakEven, gainLoss, percentChange } from "./toolMath";

const ok = <T>(result: { ok: boolean; value?: T }) => {
  expect(result.ok).toBe(true);
  return result.value as T;
};
const errors = (result: { ok: boolean; errors?: Array<{ kind: string; field: string }> }) => {
  expect(result.ok).toBe(false);
  return result.errors!.map((e) => `${e.field}:${e.kind}`);
};

describe("percentChange", () => {
  it("works out a rise and a fall", () => {
    expect(ok(percentChange("80", "100"))).toEqual({ difference: "20", percent: "25.00" });
    expect(ok(percentChange("100", "80"))).toEqual({ difference: "-20", percent: "-20.00" });
  });

  it("keeps decimals exact", () => {
    expect(ok(percentChange("0.1", "0.3"))).toEqual({ difference: "0.2", percent: "200.00" });
    expect(ok(percentChange("76,992.19", "70,000"))).toEqual({
      difference: "-6992.19",
      percent: "-9.08",
    });
  });

  it("allows an end of zero (a total loss)", () => {
    expect(ok(percentChange("50", "0"))).toEqual({ difference: "-50", percent: "-100.00" });
  });

  it("explains what is wrong, all at once", () => {
    expect(errors(percentChange("", "abc"))).toEqual(["start:missing", "end:invalid"]);
    expect(errors(percentChange("0", "5"))).toEqual(["start:zero"]);
    expect(errors(percentChange("-5", "5"))).toEqual(["start:negative"]);
  });
});

describe("gainLoss", () => {
  it("matches the example on the Education page", () => {
    // Paid $1,000, now worth $1,250 (for example 5 coins at $250).
    expect(ok(gainLoss("5", "1000", "250"))).toEqual({
      value: "1250.00",
      gain: "250.00",
      percent: "25.00",
    });
  });

  it("works out a loss and rounds to the cent", () => {
    expect(ok(gainLoss("1.5", "4100", "2286.50"))).toEqual({
      value: "3429.75",
      gain: "-670.25",
      percent: "-16.35",
    });
    expect(ok(gainLoss("0.0542", "2365", "76992.19")).value).toBe("4172.98");
  });

  it("refuses an amount paid of zero", () => {
    expect(errors(gainLoss("1", "0", "10"))).toEqual(["paid:zero"]);
  });

  it("collects every problem", () => {
    expect(errors(gainLoss("", "x", "-1"))).toEqual([
      "amount:missing",
      "paid:invalid",
      "price:negative",
    ]);
  });
});

describe("breakEven", () => {
  it("matches the example on the Education page", () => {
    expect(ok(breakEven("50"))).toEqual({ rise: "100.00" });
  });

  it("works out other falls", () => {
    expect(ok(breakEven("20"))).toEqual({ rise: "25.00" });
    expect(ok(breakEven("90"))).toEqual({ rise: "900.00" });
    expect(ok(breakEven("33.3"))).toEqual({ rise: "49.93" });
  });

  it("cannot recover from a fall of 100 percent or more, or from no fall", () => {
    expect(errors(breakEven("100"))).toEqual(["fall:range"]);
    expect(errors(breakEven("150"))).toEqual(["fall:range"]);
    expect(errors(breakEven("0"))).toEqual(["fall:zero"]);
  });
});

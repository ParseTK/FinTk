import { describe, expect, it } from "vitest";
import { divide, fromInteger, multiply, parseDecimal, round, sign, subtract } from "./decimal";

const d = (text: string) => parseDecimal(text)!;

describe("parseDecimal", () => {
  it.each([
    ["1250", 1250n, 0],
    ["1,250.50", 125050n, 2],
    [".5", 5n, 1],
    ["5.", 5n, 0],
    ["-3.25", -325n, 2],
    ["  0.10 ", 10n, 2],
  ])("reads %s", (text, units, scale) => {
    expect(parseDecimal(text)).toEqual({ units, scale });
  });

  it.each(["", "abc", "1.2.3", "1e5", "--1", "$5", "1 000", ".", "-", "1234567890123456789"])(
    "rejects %j",
    (text) => {
      expect(parseDecimal(text)).toBeNull();
    },
  );

  it("limits decimals to twelve", () => {
    expect(parseDecimal("0.1234567890123")).toBeNull();
    expect(parseDecimal("0.123456789012")).not.toBeNull();
  });
});

describe("exact arithmetic", () => {
  it("does not suffer binary float error", () => {
    expect(round(subtract(d("0.3"), d("0.2")), 1)).toBe("0.1");
    expect(round(multiply(d("0.1"), d("3")), 1)).toBe("0.3");
  });

  it("rounds half up, away from zero", () => {
    expect(divide(d("1"), d("8"), 2)).toBe("0.13"); // 0.125
    expect(divide(d("-1"), d("8"), 2)).toBe("-0.13");
    expect(divide(d("1"), d("3"), 2)).toBe("0.33");
    expect(divide(d("2"), d("3"), 2)).toBe("0.67");
  });

  it("never prints a negative zero", () => {
    expect(divide(d("-1"), d("1000"), 2)).toBe("0.00");
  });

  it("returns null for division by zero", () => {
    expect(divide(d("5"), d("0"), 2)).toBeNull();
  });

  it("handles different scales", () => {
    expect(round(subtract(d("10.5"), d("0.125")), 3)).toBe("10.375");
    expect(round(multiply(d("0.0542"), d("76992.19")), 2)).toBe("4172.98");
  });

  it("reports the sign", () => {
    expect([sign(d("-1")), sign(d("0")), sign(d("2"))]).toEqual([-1, 0, 1]);
    expect(sign(fromInteger(0))).toBe(0);
  });
});

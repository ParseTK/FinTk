import { describe, expect, it } from "vitest";
import { contrastRatio, hexToRgb } from "./contrast";

describe("contrastRatio", () => {
  it("is 21 for black on white and 1 for identical colors", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#336699", "#336699")).toBeCloseTo(1, 5);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#1d4ed8", "#ffffff")).toBeCloseTo(
      contrastRatio("#ffffff", "#1d4ed8"),
      10,
    );
  });

  it("matches a known value (#777 on white is about 4.48)", () => {
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 1);
  });
});

describe("hexToRgb", () => {
  it("parses 6-digit hex and rejects anything else", () => {
    expect(hexToRgb("#0f172a")).toEqual([15, 23, 42]);
    expect(() => hexToRgb("red")).toThrow();
    expect(() => hexToRgb("#fff")).toThrow();
  });
});

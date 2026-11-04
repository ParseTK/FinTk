import { describe, expect, it } from "vitest";
import { DEFAULT_MODE, isMode, MODE_COOKIE, MODE_LABELS, MODES, parseMode } from "./mode";

describe("mode", () => {
  it("has exactly two modes and crypto is the default", () => {
    expect(MODES).toEqual(["crypto", "stocks"]);
    expect(DEFAULT_MODE).toBe("crypto");
  });

  it("labels every mode", () => {
    for (const mode of MODES) expect(MODE_LABELS[mode]).toBeTruthy();
  });

  it("uses a cookie name that is obviously ours", () => {
    expect(MODE_COOKIE).toBe("virello_mode");
  });

  it.each(MODES)("recognises %s", (mode) => {
    expect(isMode(mode)).toBe(true);
    expect(parseMode(mode)).toBe(mode);
  });

  it.each([
    undefined,
    null,
    "",
    "CRYPTO",
    "Stocks",
    "stock",
    " crypto",
    "crypto ",
    "bonds",
    "__proto__",
  ])("falls back to the default for %j", (value) => {
    expect(isMode(value)).toBe(false);
    expect(parseMode(value as string | null | undefined)).toBe(DEFAULT_MODE);
  });

  it.each([1, true, {}, [], ["crypto"]])("does not treat %j as a mode", (value) => {
    expect(isMode(value)).toBe(false);
  });
});

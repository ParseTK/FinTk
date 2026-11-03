import { describe, expect, it } from "vitest";
import { isValidTicker } from "./ticker";

describe("isValidTicker", () => {
  it.each(["AAPL", "aapl", "BRK-B", "BRK.B", "F", "ABCDEF"])("accepts %s", (ticker) => {
    expect(isValidTicker(ticker)).toBe(true);
  });

  it.each(["", "ABCDEFG", "AAPL1", "AA PL", "../etc", "AAPL/x", "BRK-", "BRK-BBB", "%41", "A\n"])(
    "rejects %j",
    (ticker) => {
      expect(isValidTicker(ticker)).toBe(false);
    },
  );
});

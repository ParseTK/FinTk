import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { isValidTicker, getCompanyProfile } = await import("./fmp");

describe("isValidTicker", () => {
  it.each(["AAPL", "BRK.B", "^GSPC", "BF-B"])("accepts %s", (ticker) => {
    expect(isValidTicker(ticker)).toBe(true);
  });

  it.each(["", "../etc/passwd", "AAPL?x=1", "a b", "WAYTOOLONGTICKER1"])("rejects %j", (ticker) => {
    expect(isValidTicker(ticker)).toBe(false);
  });
});

describe("getCompanyProfile", () => {
  it("returns null for an invalid ticker without calling the network", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await getCompanyProfile("../x")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

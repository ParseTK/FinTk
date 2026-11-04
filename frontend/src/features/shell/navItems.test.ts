import { afterEach, describe, expect, it, vi } from "vitest";
import { navItems } from "./navItems";

describe("navItems", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is just the always-on links while the flags are off", () => {
    expect(navItems().map((item) => item.href)).toEqual(["/search"]);
  });

  it("adds each flagged page only while its own flag is on", () => {
    vi.stubEnv("FEATURE_NEWS", "true");
    expect(navItems().map((item) => item.href)).toEqual(["/search", "/news"]);
    vi.stubEnv("FEATURE_MARKETS", "true");
    expect(navItems().map((item) => item.href)).toEqual(["/search", "/markets", "/news"]);
    vi.stubEnv("FEATURE_CRYPTO", "true");
    expect(navItems().map((item) => item.href)).toEqual([
      "/search",
      "/markets",
      "/crypto",
      "/news",
    ]);
  });

  it("shows the crypto link only with the crypto flag", () => {
    vi.stubEnv("FEATURE_MARKETS", "true");
    vi.stubEnv("FEATURE_NEWS", "true");
    expect(navItems().map((item) => item.href)).not.toContain("/crypto");
    vi.stubEnv("FEATURE_MARKETS", "false");
    vi.stubEnv("FEATURE_NEWS", "false");
    vi.stubEnv("FEATURE_CRYPTO", "true");
    expect(navItems().map((item) => item.href)).toEqual(["/search", "/crypto"]);
  });

  describe("with the Crypto | Stocks switch", () => {
    const everything = () => {
      vi.stubEnv("FEATURE_MARKETS", "true");
      vi.stubEnv("FEATURE_CRYPTO", "true");
      vi.stubEnv("FEATURE_NEWS", "true");
    };

    it("shows every link when there is no mode, as before the switch existed", () => {
      everything();
      expect(navItems().map((item) => item.href)).toEqual([
        "/search",
        "/markets",
        "/crypto",
        "/news",
      ]);
      expect(navItems(null).map((item) => item.href)).toHaveLength(4);
    });

    it("shows only the crypto link in Crypto mode", () => {
      everything();
      expect(navItems("crypto").map((item) => item.href)).toEqual(["/crypto"]);
    });

    it("shows the company-research links in Stocks mode", () => {
      everything();
      expect(navItems("stocks").map((item) => item.href)).toEqual(["/search", "/markets", "/news"]);
    });

    it("still hides a link whose own flag is off, in any mode", () => {
      vi.stubEnv("FEATURE_CRYPTO", "true");
      expect(navItems("stocks").map((item) => item.href)).toEqual(["/search"]);
      expect(navItems("crypto").map((item) => item.href)).toEqual(["/crypto"]);
    });

    it("adds Crypto markets only with its own flag, and only in Crypto mode", () => {
      vi.stubEnv("FEATURE_CRYPTO", "true");
      expect(navItems("crypto").map((item) => item.href)).toEqual(["/crypto"]);
      vi.stubEnv("FEATURE_CRYPTO_MARKETS", "true");
      expect(navItems("crypto").map((item) => item.href)).toEqual(["/crypto", "/crypto/markets"]);
      expect(navItems("stocks").map((item) => item.href)).toEqual(["/search"]);
    });

    it("never shows the Crypto markets link while the crypto page itself is off (it would be a dead link)", () => {
      vi.stubEnv("FEATURE_CRYPTO_MARKETS", "true");
      expect(navItems().map((item) => item.href)).not.toContain("/crypto/markets");
      expect(navItems("crypto").map((item) => item.href)).not.toContain("/crypto/markets");
    });

    it("adds Crypto news only with its own flag and the crypto flag, in Crypto mode only", () => {
      vi.stubEnv("FEATURE_CRYPTO_NEWS", "true");
      expect(navItems("crypto").map((item) => item.href)).not.toContain("/crypto/news");
      vi.stubEnv("FEATURE_CRYPTO", "true");
      expect(navItems("crypto").map((item) => item.href)).toEqual(["/crypto", "/crypto/news"]);
      expect(navItems("stocks").map((item) => item.href)).toEqual(["/search"]);
    });

    it("gives the Crypto link exact matching, so it is not current on the markets page", () => {
      vi.stubEnv("FEATURE_CRYPTO", "true");
      vi.stubEnv("FEATURE_CRYPTO_MARKETS", "true");
      const items = navItems("crypto");
      expect(items.find((item) => item.href === "/crypto")?.exact).toBe(true);
      expect(items.find((item) => item.href === "/crypto/markets")?.exact).toBeFalsy();
    });

    it("never repeats a link across the two modes", () => {
      everything();
      const crypto = navItems("crypto").map((item) => item.href);
      const stocks = navItems("stocks").map((item) => item.href);
      expect(crypto.filter((href) => stocks.includes(href))).toEqual([]);
    });
  });
});

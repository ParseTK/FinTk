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
});

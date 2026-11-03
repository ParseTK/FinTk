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
  });
});

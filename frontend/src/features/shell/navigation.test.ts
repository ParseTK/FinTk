import { describe, expect, it } from "vitest";
import { isActivePath, NAV_ITEMS } from "./navigation";

describe("isActivePath", () => {
  it("matches the exact path and its children", () => {
    expect(isActivePath("/search", "/search")).toBe(true);
    expect(isActivePath("/search/anything", "/search")).toBe(true);
  });

  it("does not match a different path that merely starts with the same letters", () => {
    expect(isActivePath("/searching", "/search")).toBe(false);
    expect(isActivePath("/company/AAPL", "/search")).toBe(false);
  });

  it("with exact, matches only that very path and not the pages beneath it", () => {
    expect(isActivePath("/crypto", "/crypto", true)).toBe(true);
    expect(isActivePath("/crypto/markets", "/crypto", true)).toBe(false);
    expect(isActivePath("/crypto/markets", "/crypto/markets", true)).toBe(true);
    expect(isActivePath("/crypto/markets", "/crypto")).toBe(true); // without exact, as before
  });

  it("treats / as active only on the home page", () => {
    expect(isActivePath("/", "/")).toBe(true);
    expect(isActivePath("/search", "/")).toBe(false);
  });
});

describe("NAV_ITEMS", () => {
  it("has unique, absolute hrefs", () => {
    const hrefs = NAV_ITEMS.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const href of hrefs) expect(href.startsWith("/")).toBe(true);
  });
});

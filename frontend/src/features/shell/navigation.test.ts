import { describe, expect, it } from "vitest";
import { isActivePath } from "./navigation";

describe("isActivePath", () => {
  it("matches the exact path and its children", () => {
    expect(isActivePath("/crypto", "/crypto")).toBe(true);
    expect(isActivePath("/crypto/anything", "/crypto")).toBe(true);
  });

  it("does not match a different path that merely starts with the same letters", () => {
    expect(isActivePath("/cryptocurrencies", "/crypto")).toBe(false);
    expect(isActivePath("/account", "/crypto")).toBe(false);
  });

  it("with exact, matches only that very path and not the pages beneath it", () => {
    expect(isActivePath("/crypto", "/crypto", true)).toBe(true);
    expect(isActivePath("/crypto/markets", "/crypto", true)).toBe(false);
    expect(isActivePath("/crypto/markets", "/crypto/markets", true)).toBe(true);
    expect(isActivePath("/crypto/markets", "/crypto")).toBe(true); // without exact, as before
  });

  it("treats / as active only on the home page", () => {
    expect(isActivePath("/", "/")).toBe(true);
    expect(isActivePath("/crypto", "/")).toBe(false);
  });
});

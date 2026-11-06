import { afterEach, describe, expect, it, vi } from "vitest";
import { isGatedOff, isUnder } from "./gates";

afterEach(() => vi.unstubAllEnvs());

describe("isUnder", () => {
  it("matches the page itself and what is below it, not a longer name", () => {
    expect(isUnder("/crypto", "/crypto")).toBe(true);
    expect(isUnder("/crypto/markets", "/crypto")).toBe(true);
    expect(isUnder("/cryptography", "/crypto")).toBe(false);
  });
});

describe("isGatedOff", () => {
  it("leaves pages that have no gate open", () => {
    expect(isGatedOff("/")).toBe(false);
    expect(isGatedOff("/privacy")).toBe(false);
  });

  it("closes a gated page while its flag is off, and opens it when the flag is on", () => {
    vi.stubEnv("FEATURE_RESOURCES", "false");
    expect(isGatedOff("/resources/tools")).toBe(true);
    vi.stubEnv("FEATURE_RESOURCES", "true");
    expect(isGatedOff("/resources/tools")).toBe(false);
  });

  it("needs every matching gate: markets stays closed while the crypto page itself is off", () => {
    vi.stubEnv("FEATURE_CRYPTO", "false");
    vi.stubEnv("FEATURE_CRYPTO_MARKETS", "true");
    expect(isGatedOff("/crypto/markets")).toBe(true);
    vi.stubEnv("FEATURE_CRYPTO", "true");
    expect(isGatedOff("/crypto/markets")).toBe(false);
  });

  it("holdings needs crypto, auth and its own flag", () => {
    vi.stubEnv("FEATURE_CRYPTO", "true");
    vi.stubEnv("FEATURE_AUTH", "true");
    vi.stubEnv("FEATURE_HOLDINGS", "false");
    expect(isGatedOff("/holdings/watchlist")).toBe(true);
    vi.stubEnv("FEATURE_HOLDINGS", "true");
    expect(isGatedOff("/holdings/watchlist")).toBe(false);
    vi.stubEnv("FEATURE_AUTH", "false");
    expect(isGatedOff("/holdings")).toBe(true);
  });
});

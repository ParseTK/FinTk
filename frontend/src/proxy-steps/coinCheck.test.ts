import { afterEach, describe, expect, it, vi } from "vitest";
import { coinFromPath, coinMissing } from "./coinCheck";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const answer = (status: number) =>
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status })));

describe("coinFromPath", () => {
  it("returns the coin name only for a coin page", () => {
    expect(coinFromPath("/crypto/coins/bitcoin")).toBe("bitcoin");
    expect(coinFromPath("/crypto/coins/a%20b")).toBe("a%20b");
    expect(coinFromPath("/crypto/coins")).toBeNull();
    expect(coinFromPath("/crypto/coins/bitcoin/extra")).toBeNull();
    expect(coinFromPath("/crypto/markets")).toBeNull();
  });
});

describe("coinMissing", () => {
  it("is true when the API says the coin is not covered", async () => {
    answer(404);
    expect(await coinMissing("nope")).toBe(true);
  });

  it("is false for a covered coin, and asks with the internal token when there is one", async () => {
    vi.stubEnv("INTERNAL_API_TOKEN", "same-same-same");
    answer(200);
    expect(await coinMissing("bitcoin")).toBe(false);
    const [url, options] = vi.mocked(fetch).mock.calls[0]!;
    expect(String(url)).toContain("/api/v1/crypto/coins/bitcoin");
    expect((options!.headers as Record<string, string>)["X-Internal-Token"]).toBe("same-same-same");
  });

  it("refuses a malformed name without asking the API at all", async () => {
    answer(200);
    expect(await coinMissing("%E0%A4%A")).toBe(true); // not valid percent-encoding
    expect(await coinMissing("../etc/passwd")).toBe(true);
    expect(await coinMissing("Bad Name")).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("lets the page through when the API cannot answer, so an outage never makes 404s", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect(await coinMissing("bitcoin")).toBe(false);
    answer(500);
    expect(await coinMissing("bitcoin")).toBe(false);
  });
});

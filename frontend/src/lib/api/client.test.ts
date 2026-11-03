import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ name: "x", version: "1", environment: "test" }), {
      headers: { "content-type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const sentHeader = () => (fetchMock.mock.calls[0]![0] as Request).headers.get("x-internal-token");

describe("API client", () => {
  it("sends the shared secret when one is configured, for cached and uncached calls", async () => {
    vi.stubEnv("INTERNAL_API_TOKEN", "same-same-same-same-same-same-same-same");
    const { privateApi, publicApi } = await import("./client");

    await publicApi.GET("/api/v1/meta");
    expect(sentHeader()).toBe("same-same-same-same-same-same-same-same");

    fetchMock.mockClear();
    fetchMock.mockResolvedValue(
      new Response("{}", { headers: { "content-type": "application/json" } }),
    );
    await privateApi.GET("/api/v1/meta");
    expect(sentHeader()).toBe("same-same-same-same-same-same-same-same");
  });

  it("sends no such header when none is configured", async () => {
    vi.stubEnv("INTERNAL_API_TOKEN", "");
    const { publicApi } = await import("./client");
    await publicApi.GET("/api/v1/meta");
    expect(sentHeader()).toBeNull();
  });

  it("reads the secret per request, so a changed value applies without a rebuild", async () => {
    const { publicApi } = await import("./client");
    vi.stubEnv("INTERNAL_API_TOKEN", "first-first-first-first-first-first-fi");
    await publicApi.GET("/api/v1/meta");
    expect(sentHeader()).toBe("first-first-first-first-first-first-fi");

    fetchMock.mockClear();
    fetchMock.mockResolvedValue(
      new Response("{}", { headers: { "content-type": "application/json" } }),
    );
    vi.stubEnv("INTERNAL_API_TOKEN", "second-second-second-second-second-se");
    await publicApi.GET("/api/v1/meta");
    expect(sentHeader()).toBe("second-second-second-second-second-se");
  });
});

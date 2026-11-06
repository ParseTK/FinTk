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

  describe("waiting for a sleeping API", () => {
    const starting = () =>
      new Response("starting", { status: 503, headers: { "content-type": "text/html" } });
    const ok = () => new Response("{}", { headers: { "content-type": "application/json" } });

    it("keeps trying data reads while the host is starting", async () => {
      vi.stubEnv("API_WAKE_BUDGET_MS", "60000");
      vi.useFakeTimers({ shouldAdvanceTime: true });
      fetchMock.mockReset();
      fetchMock.mockResolvedValueOnce(starting()).mockResolvedValueOnce(ok());
      const { privateApi } = await import("./client");
      const pending = privateApi.GET("/api/v1/meta");
      await vi.advanceTimersByTimeAsync(2_500);
      const { response } = await pending;
      vi.useRealTimers();
      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("does not wait for the per-page who-is-signed-in check", async () => {
      vi.stubEnv("API_WAKE_BUDGET_MS", "60000");
      fetchMock.mockReset();
      fetchMock.mockResolvedValue(starting());
      const { quickApi } = await import("./client");
      const { response } = await quickApi.GET("/api/v1/meta");
      expect(response.status).toBe(503);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("makes one attempt in development, where a down API should fail fast", async () => {
      vi.stubEnv("API_WAKE_BUDGET_MS", "");
      vi.stubEnv("NODE_ENV", "test");
      fetchMock.mockReset();
      fetchMock.mockResolvedValue(starting());
      const { privateApi } = await import("./client");
      await privateApi.GET("/api/v1/meta");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});

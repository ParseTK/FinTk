import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isForwardedApiPath, proxy } from "./proxy";

const request = (path: string) => new NextRequest(`http://localhost:3000${path}`);
const rewrittenTo = (response: Response) => response.headers.get("x-middleware-rewrite");
const passesThrough = (response: Response) => response.headers.get("x-middleware-next") === "1";

afterEach(() => vi.unstubAllEnvs());

describe("pages behind a flag", () => {
  it.each(["/design", "/design/colors", "/sign-in", "/account", "/markets"])(
    "%s is a real 404 while its flag is off",
    async (path) => {
      expect(rewrittenTo(await proxy(request(path)))).toBe(
        "http://localhost:3000/not-found-disabled",
      );
    },
  );

  it("lets sign-in pages through when the auth flag is on", async () => {
    vi.stubEnv("FEATURE_AUTH", "true");
    expect(passesThrough(await proxy(request("/sign-in")))).toBe(true);
    expect(passesThrough(await proxy(request("/account")))).toBe(true);
  });

  it("does not let the auth flag open the design gallery", async () => {
    vi.stubEnv("FEATURE_AUTH", "true");
    expect(rewrittenTo(await proxy(request("/design")))).toContain("/not-found-disabled");
  });
});

describe("forwarding sign-in calls to the API", () => {
  it("forwards nothing while the auth flag is off", async () => {
    expect(rewrittenTo(await proxy(request("/api/v1/auth/session")))).toContain(
      "/not-found-disabled",
    );
    expect(rewrittenTo(await proxy(request("/api/v1/me")))).toContain("/not-found-disabled");
  });

  it("forwards sign-in and me calls to the API, keeping the path and query", async () => {
    vi.stubEnv("FEATURE_AUTH", "true");
    vi.stubEnv("API_URL", "https://api.virello.example");

    expect(rewrittenTo(await proxy(request("/api/v1/auth/github/login?next=%2Faccount")))).toBe(
      "https://api.virello.example/api/v1/auth/github/login?next=%2Faccount",
    );
    expect(rewrittenTo(await proxy(request("/api/v1/me")))).toBe(
      "https://api.virello.example/api/v1/me",
    );
  });

  it("falls back to the local API when API_URL is not set", async () => {
    vi.stubEnv("FEATURE_AUTH", "true");
    expect(rewrittenTo(await proxy(request("/api/v1/auth/session")))).toBe(
      "http://localhost:8000/api/v1/auth/session",
    );
  });

  it.each([
    "/api/v1/companies/AAPL", // company data is called by the server, never by browsers
    "/api/v1/meta", // starts with /api/v1/me but is a different route
    "/api/v1/auth", // no trailing slash: not a sign-in path
    "/api/v1/mesomething",
    "/api/healthz",
    "/api/docs",
    "/api/openapi.json",
    "/api/",
    "/api/v1/auth/../companies/AAPL", // dot segments are resolved before the check
    "/api/v1/auth/%2e%2e/companies/AAPL", // ...including the encoded form
    "/api/v1/auth/%2E%2E/%2E%2E/healthz",
  ])("never forwards %s", async (path) => {
    vi.stubEnv("FEATURE_AUTH", "true");
    const target = rewrittenTo(await proxy(request(path)));
    expect(target).toContain("/not-found-disabled");
    expect(target).not.toContain("8000");
  });

  it("matches only exact allowlisted paths", async () => {
    expect(isForwardedApiPath("/api/v1/me")).toBe(true);
    expect(isForwardedApiPath("/api/v1/auth/session")).toBe(true);
    expect(isForwardedApiPath("/api/v1/meta")).toBe(false);
    expect(isForwardedApiPath("/api/v1/me/extra")).toBe(false);
    expect(isForwardedApiPath("/api/v1/companies/search")).toBe(false);
  });
});

describe("watchlist and portfolio paths", () => {
  it.each(["/watchlist", "/portfolio"])(
    "%s is a real 404 while the auth flag is off",
    async (path) => {
      expect(rewrittenTo(await proxy(request(path)))).toContain("/not-found-disabled");
    },
  );

  it.each(["/watchlist", "/portfolio"])("%s is reachable once the flag is on", async (path) => {
    vi.stubEnv("FEATURE_AUTH", "true");
    expect(passesThrough(await proxy(request(path)))).toBe(true);
  });

  it.each([
    "/api/v1/watchlist",
    "/api/v1/watchlist/AAPL",
    "/api/v1/portfolio",
    "/api/v1/portfolio/lots",
    "/api/v1/portfolio/lots/2f6ac1d6-0d0e-4c52-a3e6-0f0f2f9f3b11?x=1",
  ])("forwards %s to the API when the flag is on", async (path) => {
    vi.stubEnv("FEATURE_AUTH", "true");
    vi.stubEnv("API_URL", "https://api.virello.example");
    expect(rewrittenTo(await proxy(request(path)))).toBe(`https://api.virello.example${path}`);
  });

  it.each(["/api/v1/watchlist", "/api/v1/portfolio/lots"])(
    "does not forward %s while the flag is off",
    async (path) => {
      expect(rewrittenTo(await proxy(request(path)))).toContain("/not-found-disabled");
    },
  );

  it.each([
    "/api/v1/watchlistx",
    "/api/v1/portfolioish",
    "/api/v1/portfolio/../companies/AAPL",
    "/api/v1/watchlist/%2e%2e/companies/AAPL",
    "/api/v1/watchlist/%2E%2E/%2E%2E/healthz",
  ])("never forwards the look-alike or traversal path %s", async (path) => {
    vi.stubEnv("FEATURE_AUTH", "true");
    const target = rewrittenTo(await proxy(request(path)));
    expect(target).toContain("/not-found-disabled");
    expect(target).not.toContain("8000");
  });
});

describe("company pages", () => {
  const apiAnswers = (response: Response | Error) => {
    const fetchMock = vi.fn(async () => {
      if (response instanceof Error) throw response;
      return response;
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  };
  afterEach(() => vi.unstubAllGlobals());

  it("answers a real 404 for a ticker the API does not know", async () => {
    apiAnswers(new Response(null, { status: 404 }));
    expect(rewrittenTo(await proxy(request("/company/ZZZZ")))).toBe(
      "http://localhost:3000/not-found-disabled",
    );
  });

  it("lets a known company through", async () => {
    apiAnswers(new Response("{}", { status: 200 }));
    expect(passesThrough(await proxy(request("/company/AAPL")))).toBe(true);
  });

  it("checks the API for the ticker in the path, escaped, at the configured address", async () => {
    vi.stubEnv("API_URL", "https://api.virello.example");
    const fetchMock = apiAnswers(new Response("{}", { status: 200 }));
    await proxy(request("/company/brk-b"));
    const [url, options] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe("https://api.virello.example/api/v1/companies/brk-b");
    expect(options.cache).toBe("no-store");
    expect(options.signal).toBeInstanceOf(AbortSignal); // never waits indefinitely
  });

  it.each([
    "/company/",
    "/company/..%2Fetc",
    "/company/AAPL1",
    "/company/%41%",
    "/company/ABCDEFGH",
  ])("refuses %s without asking the API", async (path) => {
    const fetchMock = apiAnswers(new Response("{}", { status: 200 }));
    expect(rewrittenTo(await proxy(request(path)))).toContain("/not-found-disabled");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["the API errors", new Response(null, { status: 500 })],
    ["the API is unreachable", new Error("connection refused")],
    ["the API is too slow", new DOMException("timed out", "TimeoutError")],
    ["the API rate-limits", new Response(null, { status: 429 })],
  ])("never turns an outage into a 404: %s", async (_, outcome) => {
    apiAnswers(outcome as Response | Error);
    expect(passesThrough(await proxy(request("/company/AAPL")))).toBe(true);
  });
});

describe("the markets page", () => {
  it("opens with its own flag, and the auth flag does not open it", async () => {
    vi.stubEnv("FEATURE_AUTH", "true");
    expect(rewrittenTo(await proxy(request("/markets")))).toContain("/not-found-disabled");
    vi.stubEnv("FEATURE_MARKETS", "true");
    expect(passesThrough(await proxy(request("/markets")))).toBe(true);
  });
});

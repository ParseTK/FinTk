import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isForwardedApiPath, proxy } from "./proxy";

const request = (path: string) => new NextRequest(`http://localhost:3000${path}`);
const rewrittenTo = (response: Response) => response.headers.get("x-middleware-rewrite");
const passesThrough = (response: Response) => response.headers.get("x-middleware-next") === "1";

afterEach(() => vi.unstubAllEnvs());

describe("pages behind a flag", () => {
  it.each(["/design", "/design/colors", "/sign-in", "/account"])(
    "%s is a real 404 while its flag is off",
    (path) => {
      expect(rewrittenTo(proxy(request(path)))).toBe("http://localhost:3000/not-found-disabled");
    },
  );

  it("lets sign-in pages through when the auth flag is on", () => {
    vi.stubEnv("FEATURE_AUTH", "true");
    expect(passesThrough(proxy(request("/sign-in")))).toBe(true);
    expect(passesThrough(proxy(request("/account")))).toBe(true);
  });

  it("does not let the auth flag open the design gallery", () => {
    vi.stubEnv("FEATURE_AUTH", "true");
    expect(rewrittenTo(proxy(request("/design")))).toContain("/not-found-disabled");
  });
});

describe("forwarding sign-in calls to the API", () => {
  it("forwards nothing while the auth flag is off", () => {
    expect(rewrittenTo(proxy(request("/api/v1/auth/session")))).toContain("/not-found-disabled");
    expect(rewrittenTo(proxy(request("/api/v1/me")))).toContain("/not-found-disabled");
  });

  it("forwards sign-in and me calls to the API, keeping the path and query", () => {
    vi.stubEnv("FEATURE_AUTH", "true");
    vi.stubEnv("API_URL", "https://api.virello.example");

    expect(rewrittenTo(proxy(request("/api/v1/auth/github/login?next=%2Faccount")))).toBe(
      "https://api.virello.example/api/v1/auth/github/login?next=%2Faccount",
    );
    expect(rewrittenTo(proxy(request("/api/v1/me")))).toBe("https://api.virello.example/api/v1/me");
  });

  it("falls back to the local API when API_URL is not set", () => {
    vi.stubEnv("FEATURE_AUTH", "true");
    expect(rewrittenTo(proxy(request("/api/v1/auth/session")))).toBe(
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
  ])("never forwards %s", (path) => {
    vi.stubEnv("FEATURE_AUTH", "true");
    const target = rewrittenTo(proxy(request(path)));
    expect(target).toContain("/not-found-disabled");
    expect(target).not.toContain("8000");
  });

  it("matches only exact allowlisted paths", () => {
    expect(isForwardedApiPath("/api/v1/me")).toBe(true);
    expect(isForwardedApiPath("/api/v1/auth/session")).toBe(true);
    expect(isForwardedApiPath("/api/v1/meta")).toBe(false);
    expect(isForwardedApiPath("/api/v1/me/extra")).toBe(false);
    expect(isForwardedApiPath("/api/v1/companies/search")).toBe(false);
  });
});

describe("watchlist and portfolio paths", () => {
  it.each(["/watchlist", "/portfolio"])("%s is a real 404 while the auth flag is off", (path) => {
    expect(rewrittenTo(proxy(request(path)))).toContain("/not-found-disabled");
  });

  it.each(["/watchlist", "/portfolio"])("%s is reachable once the flag is on", (path) => {
    vi.stubEnv("FEATURE_AUTH", "true");
    expect(passesThrough(proxy(request(path)))).toBe(true);
  });

  it.each([
    "/api/v1/watchlist",
    "/api/v1/watchlist/AAPL",
    "/api/v1/portfolio",
    "/api/v1/portfolio/lots",
    "/api/v1/portfolio/lots/2f6ac1d6-0d0e-4c52-a3e6-0f0f2f9f3b11?x=1",
  ])("forwards %s to the API when the flag is on", (path) => {
    vi.stubEnv("FEATURE_AUTH", "true");
    vi.stubEnv("API_URL", "https://api.virello.example");
    expect(rewrittenTo(proxy(request(path)))).toBe(`https://api.virello.example${path}`);
  });

  it.each(["/api/v1/watchlist", "/api/v1/portfolio/lots"])(
    "does not forward %s while the flag is off",
    (path) => {
      expect(rewrittenTo(proxy(request(path)))).toContain("/not-found-disabled");
    },
  );

  it.each([
    "/api/v1/watchlistx",
    "/api/v1/portfolioish",
    "/api/v1/portfolio/../companies/AAPL",
    "/api/v1/watchlist/%2e%2e/companies/AAPL",
    "/api/v1/watchlist/%2E%2E/%2E%2E/healthz",
  ])("never forwards the look-alike or traversal path %s", (path) => {
    vi.stubEnv("FEATURE_AUTH", "true");
    const target = rewrittenTo(proxy(request(path)));
    expect(target).toContain("/not-found-disabled");
    expect(target).not.toContain("8000");
  });
});

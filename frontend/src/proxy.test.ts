import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isForwardedApiPath, proxy } from "./proxy";

const request = (path: string) => new NextRequest(`http://localhost:3000${path}`);
const rewrittenTo = (response: Response) => response.headers.get("x-middleware-rewrite");
const passesThrough = (response: Response) => response.headers.get("x-middleware-next") === "1";

afterEach(() => vi.unstubAllEnvs());

describe("pages behind a flag", () => {
  it.each(["/design", "/design/colors", "/sign-in", "/account", "/crypto", "/crypto/news"])(
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
    "/api/v1/watchlist", // the stock watchlist and portfolio are gone
    "/api/v1/portfolio/lots",
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

describe("the crypto page", () => {
  it("opens with its own flag, and the auth flag does not open it", async () => {
    vi.stubEnv("FEATURE_AUTH", "true");
    expect(rewrittenTo(await proxy(request("/crypto")))).toContain("/not-found-disabled");
    vi.stubEnv("FEATURE_CRYPTO", "true");
    expect(passesThrough(await proxy(request("/crypto")))).toBe(true);
  });

  it("is never reachable as an API path through the browser proxy", async () => {
    vi.stubEnv("FEATURE_AUTH", "true");
    vi.stubEnv("FEATURE_CRYPTO", "true");
    expect(rewrittenTo(await proxy(request("/api/v1/crypto/overview")))).toContain(
      "/not-found-disabled",
    );
  });
});

describe("the crypto markets page", () => {
  it("needs both the crypto flag and its own flag", async () => {
    expect(rewrittenTo(await proxy(request("/crypto/markets")))).toContain("/not-found-disabled");
    vi.stubEnv("FEATURE_CRYPTO_MARKETS", "true"); // markets alone does not open it
    expect(rewrittenTo(await proxy(request("/crypto/markets")))).toContain("/not-found-disabled");
    vi.stubEnv("FEATURE_CRYPTO", "true");
    expect(passesThrough(await proxy(request("/crypto/markets")))).toBe(true);
  });

  it("is closed by its own flag even while the crypto page is open", async () => {
    vi.stubEnv("FEATURE_CRYPTO", "true");
    expect(rewrittenTo(await proxy(request("/crypto/markets")))).toContain("/not-found-disabled");
    expect(passesThrough(await proxy(request("/crypto")))).toBe(true);
  });

  it("does not open the crypto page", async () => {
    vi.stubEnv("FEATURE_CRYPTO_MARKETS", "true");
    expect(rewrittenTo(await proxy(request("/crypto")))).toContain("/not-found-disabled");
  });
});

describe("the crypto news page", () => {
  it("needs both the crypto flag and its own flag", async () => {
    expect(rewrittenTo(await proxy(request("/crypto/news")))).toContain("/not-found-disabled");
    vi.stubEnv("FEATURE_CRYPTO_NEWS", "true"); // news alone does not open it
    expect(rewrittenTo(await proxy(request("/crypto/news")))).toContain("/not-found-disabled");
    vi.stubEnv("FEATURE_CRYPTO", "true");
    expect(passesThrough(await proxy(request("/crypto/news")))).toBe(true);
  });

  it("is closed by its own flag even while the crypto page is open", async () => {
    vi.stubEnv("FEATURE_CRYPTO", "true");
    expect(rewrittenTo(await proxy(request("/crypto/news")))).toContain("/not-found-disabled");
    expect(passesThrough(await proxy(request("/crypto")))).toBe(true);
  });
});

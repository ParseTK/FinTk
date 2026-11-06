import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { proxy } from "./proxy";
import { isForwardedApiPath } from "./proxy-steps/forwarding";

const request = (path: string) => new NextRequest(`http://localhost:3000${path}`);
const rewrittenTo = (response: Response) => response.headers.get("x-middleware-rewrite");
const passesThrough = (response: Response) => response.headers.get("x-middleware-next") === "1";

const withSession = (path: string) =>
  new NextRequest(`http://localhost:3000${path}`, { headers: { cookie: "virello_session=abc" } });

afterEach(() => vi.unstubAllEnvs());

describe("pages for signed-in people", () => {
  beforeEach(() => {
    vi.stubEnv("FEATURE_AUTH", "true");
    vi.stubEnv("FEATURE_CRYPTO", "true");
    vi.stubEnv("FEATURE_HOLDINGS", "true");
  });

  it.each(["/holdings", "/holdings/watchlist", "/account"])(
    "%s sends a visitor with no session to sign in before rendering",
    async (path) => {
      const response = await proxy(request(path));
      expect(response.status).toBe(307);
      const location = new URL(response.headers.get("location")!);
      expect(location.pathname).toBe("/sign-in");
      expect(location.searchParams.get("next")).toBe(path);
    },
  );

  it("lets a visitor with a session cookie through (the page checks it)", async () => {
    expect(passesThrough(await proxy(withSession("/holdings")))).toBe(true);
    expect(passesThrough(await proxy(withSession("/holdings/watchlist")))).toBe(true);
  });

  it("still answers 404 for a closed page rather than redirecting", async () => {
    vi.stubEnv("FEATURE_HOLDINGS", "false");
    expect(rewrittenTo(await proxy(request("/holdings")))).toContain("/not-found-disabled");
  });
});

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
    expect(passesThrough(await proxy(withSession("/account")))).toBe(true);
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
    vi.stubEnv("FEATURE_AUTH", "true");
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

describe("coin and search pages", () => {
  const NOT_FOUND = "http://localhost:3000/not-found-disabled";

  it.each(["/crypto/search", "/crypto/coins/bitcoin"])(
    "%s is a real 404 while the search flag is off, even with crypto on",
    async (path) => {
      vi.stubEnv("FEATURE_CRYPTO", "true");
      expect(rewrittenTo(await proxy(request(path)))).toBe(NOT_FOUND);
    },
  );

  it("lets the search page through when both flags are on", async () => {
    vi.stubEnv("FEATURE_CRYPTO", "true");
    vi.stubEnv("FEATURE_CRYPTO_SEARCH", "true");
    expect(passesThrough(await proxy(request("/crypto/search?q=bit")))).toBe(true);
  });

  describe("an unknown coin", () => {
    const fetchSpy = vi.fn();
    beforeEach(() => {
      vi.stubEnv("FEATURE_CRYPTO", "true");
      vi.stubEnv("FEATURE_CRYPTO_SEARCH", "true");
      vi.stubGlobal("fetch", fetchSpy);
      fetchSpy.mockReset();
    });
    afterEach(() => vi.unstubAllGlobals());

    it("is a real 404 when the API says the coin is not covered", async () => {
      fetchSpy.mockResolvedValue(new Response("{}", { status: 404 }));
      expect(rewrittenTo(await proxy(request("/crypto/coins/nope")))).toBe(NOT_FOUND);
    });

    it("lets a covered coin through, sending the internal token only to the API", async () => {
      vi.stubEnv("INTERNAL_API_TOKEN", "same-same-same-same-same-same-same-same");
      fetchSpy.mockResolvedValue(new Response("{}", { status: 200 }));
      expect(passesThrough(await proxy(request("/crypto/coins/bitcoin")))).toBe(true);
      const [url, init] = fetchSpy.mock.calls[0]!;
      expect(String(url)).toContain("/api/v1/crypto/coins/bitcoin");
      expect(init.headers["X-Internal-Token"]).toBe("same-same-same-same-same-same-same-same");
    });

    it("fails open: an API outage does not turn a good link into a 404", async () => {
      fetchSpy.mockRejectedValue(new Error("down"));
      expect(passesThrough(await proxy(request("/crypto/coins/bitcoin")))).toBe(true);
      fetchSpy.mockResolvedValue(new Response("{}", { status: 502 }));
      expect(passesThrough(await proxy(request("/crypto/coins/bitcoin")))).toBe(true);
    });

    it.each([
      "/crypto/coins/UPPER",
      "/crypto/coins/-x",
      "/crypto/coins/%E0%A4%A",
      "/crypto/coins/a.b%2F",
    ])("%s is refused without asking the API", async (path) => {
      expect(rewrittenTo(await proxy(request(path)))).toBe(NOT_FOUND);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});

describe("holdings pages and calls", () => {
  const NOT_FOUND = "http://localhost:3000/not-found-disabled";
  const allOn = () => {
    vi.stubEnv("FEATURE_AUTH", "true");
    vi.stubEnv("FEATURE_CRYPTO", "true");
    vi.stubEnv("FEATURE_HOLDINGS", "true");
  };
  const call = (path: string, method: string) =>
    proxy(new NextRequest(`http://localhost:3000${path}`, { method }));

  it.each(["/holdings", "/holdings/watchlist"])(
    "%s is a real 404 until every flag it needs is on",
    async (path) => {
      expect(rewrittenTo(await proxy(request(path)))).toBe(NOT_FOUND);
      vi.stubEnv("FEATURE_HOLDINGS", "true");
      vi.stubEnv("FEATURE_AUTH", "true");
      expect(rewrittenTo(await proxy(request(path)))).toBe(NOT_FOUND); // crypto still off
      vi.stubEnv("FEATURE_CRYPTO", "true");
      expect(passesThrough(await proxy(withSession(path)))).toBe(true);
    },
  );

  it("forwards a browser's writes to the watchlist and portfolio", async () => {
    allOn();
    for (const method of ["PUT", "DELETE"]) {
      for (const path of ["/api/v1/watchlist/bitcoin", "/api/v1/portfolio/bitcoin"]) {
        expect(rewrittenTo(await call(path, method))).toBe(`http://localhost:8000${path}`);
      }
    }
  });

  it("never forwards a read: priced data is for our own pages only", async () => {
    allOn();
    for (const path of ["/api/v1/watchlist", "/api/v1/portfolio", "/api/v1/watchlist/bitcoin"]) {
      for (const method of ["GET", "HEAD", "POST", "PATCH"]) {
        expect(rewrittenTo(await call(path, method))).toBe(NOT_FOUND);
      }
    }
  });

  it("forwards nothing while any of its flags is off", async () => {
    for (const off of ["FEATURE_AUTH", "FEATURE_CRYPTO", "FEATURE_HOLDINGS"]) {
      allOn();
      vi.stubEnv(off, "false");
      expect(rewrittenTo(await call("/api/v1/portfolio/bitcoin", "PUT"))).toBe(NOT_FOUND);
    }
  });

  it("does not forward anything outside those prefixes", async () => {
    allOn();
    for (const path of ["/api/v1/portfolio", "/api/v1/portfolios/x", "/api/v1/watchlisted/x"]) {
      expect(rewrittenTo(await call(path, "PUT"))).toBe(NOT_FOUND);
    }
  });
});

describe("Content-Security-Policy", () => {
  it("gives a page a policy with a fresh nonce, and passes the same nonce to the page", async () => {
    const first = await proxy(request("/"));
    const second = await proxy(request("/"));
    const policy = first.headers.get("Content-Security-Policy")!;
    const nonce = /'nonce-([^']+)'/.exec(policy)![1];
    expect(policy).toContain("default-src 'self'");
    expect(passesThrough(first)).toBe(true);
    // Next copies request-header overrides onto the page request: that is how the layout sees it.
    expect(first.headers.get("x-middleware-request-x-nonce")).toBe(nonce);
    expect(first.headers.get("x-middleware-request-content-security-policy")).toBe(policy);
    expect(second.headers.get("Content-Security-Policy")).not.toBe(policy);
  });

  it("also covers the pages the proxy rewrites or redirects", async () => {
    vi.stubEnv("FEATURE_DESIGN", "false");
    const closed = await proxy(request("/design"));
    expect(rewrittenTo(closed)).toContain("/not-found-disabled");
    expect(closed.headers.get("Content-Security-Policy")).toContain("script-src");
  });

  it("does not add a page policy to forwarded API calls", async () => {
    vi.stubEnv("FEATURE_AUTH", "true");
    const response = await proxy(request("/api/v1/me"));
    expect(response.headers.get("Content-Security-Policy")).toBeNull();
  });

  it("only reports when CSP_MODE=report-only", async () => {
    vi.stubEnv("CSP_MODE", "report-only");
    const response = await proxy(request("/"));
    expect(response.headers.get("Content-Security-Policy")).toBeNull();
    expect(response.headers.get("Content-Security-Policy-Report-Only")).toContain("script-src");
  });

  it("sends no policy when CSP_MODE=off", async () => {
    vi.stubEnv("CSP_MODE", "off");
    const response = await proxy(request("/"));
    expect(response.headers.get("Content-Security-Policy")).toBeNull();
    expect(response.headers.get("x-middleware-request-x-nonce")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { buildCsp, cspHeaderName, cspMode, newNonce, requestIsHttps } from "./csp";

const directive = (policy: string, name: string) =>
  policy
    .split("; ")
    .find((part) => part.startsWith(`${name} `))
    ?.slice(name.length + 1);

describe("buildCsp", () => {
  const policy = buildCsp("abc123", { development: false });

  it("lets scripts run only with the request's nonce, never inline or eval", () => {
    const scripts = directive(policy, "script-src")!;
    expect(scripts).toContain("'nonce-abc123'");
    expect(scripts).toContain("'strict-dynamic'");
    expect(scripts).not.toContain("'unsafe-inline'");
    expect(scripts).not.toContain("'unsafe-eval'");
  });

  it("allows nothing from other origins, plugins, frames or base tags", () => {
    expect(directive(policy, "default-src")).toBe("'self'");
    expect(directive(policy, "connect-src")).toBe("'self'");
    expect(directive(policy, "object-src")).toBe("'none'");
    expect(directive(policy, "frame-ancestors")).toBe("'none'");
    expect(directive(policy, "base-uri")).toBe("'self'");
    expect(directive(policy, "form-action")).toBe("'self'");
    expect(policy).not.toMatch(/https?:|\*/);
  });

  it("asks for the https upgrade only when told the page came over https", () => {
    expect(policy).not.toContain("upgrade-insecure-requests");
    expect(buildCsp("abc123", { development: false, https: true })).toContain(
      "upgrade-insecure-requests",
    );
    expect(buildCsp("abc123", { https: true })).toContain("upgrade-insecure-requests");
  });

  it("keeps style elements to our own files and allows inline only for style attributes", () => {
    expect(directive(policy, "style-src")).toBe("'self'");
    expect(directive(policy, "style-src-attr")).toBe("'unsafe-inline'");
  });

  it("lets the development server use inline style elements, which it injects", () => {
    expect(directive(buildCsp("n", { development: true }), "style-src")).toContain(
      "'unsafe-inline'",
    );
  });

  it("adds eval for the development server only", () => {
    expect(directive(buildCsp("n", { development: true }), "script-src")).toContain(
      "'unsafe-eval'",
    );
  });
});

describe("newNonce", () => {
  it("is 128 bits of base64 and different every time", () => {
    const seen = new Set(Array.from({ length: 50 }, () => newNonce()));
    expect(seen.size).toBe(50);
    for (const nonce of seen) expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
});

describe("cspMode and cspHeaderName", () => {
  it("enforces unless told otherwise, and ignores unknown values", () => {
    expect(cspMode(undefined)).toBe("enforce");
    expect(cspMode("")).toBe("enforce");
    expect(cspMode("nonsense")).toBe("enforce");
    expect(cspMode(" Report-Only ")).toBe("report-only");
    expect(cspMode("off")).toBe("off");
  });

  it("names the header for each mode", () => {
    expect(cspHeaderName("enforce")).toBe("Content-Security-Policy");
    expect(cspHeaderName("report-only")).toBe("Content-Security-Policy-Report-Only");
    expect(cspHeaderName("off")).toBeNull();
  });
});

describe("requestIsHttps", () => {
  const none = new Headers();

  it("is true for an https address and false for http", () => {
    expect(requestIsHttps(none, "https://virello.example/")).toBe(true);
    expect(requestIsHttps(none, "http://localhost:3000/")).toBe(false);
  });

  it("believes the proxy in front when it says the visitor used https", () => {
    const proxied = new Headers({ "x-forwarded-proto": "https" });
    expect(requestIsHttps(proxied, "http://internal:3000/")).toBe(true);
  });

  it("uses the first value of a chain, and lets the proxy say http over an https-looking address", () => {
    expect(requestIsHttps(new Headers({ "x-forwarded-proto": "https, http" }), "http://a/")).toBe(
      true,
    );
    expect(requestIsHttps(new Headers({ "x-forwarded-proto": "http, https" }), "https://a/")).toBe(
      false,
    );
    expect(requestIsHttps(new Headers({ "x-forwarded-proto": " HTTPS " }), "http://a/")).toBe(true);
  });
});

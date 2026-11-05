import { describe, expect, it } from "vitest";
import { buildCsp, cspHeaderName, cspMode, newNonce } from "./csp";

const directive = (policy: string, name: string) =>
  policy
    .split("; ")
    .find((part) => part.startsWith(`${name} `))
    ?.slice(name.length + 1);

describe("buildCsp", () => {
  const policy = buildCsp("abc123", false);

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

  it("upgrades to https only in a production build", () => {
    expect(policy).toContain("upgrade-insecure-requests");
    expect(buildCsp("abc123", true)).not.toContain("upgrade-insecure-requests");
  });

  it("adds eval for the development server only", () => {
    expect(directive(buildCsp("n", true), "script-src")).toContain("'unsafe-eval'");
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

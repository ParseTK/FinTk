import { afterEach, describe, expect, it, vi } from "vitest";
import { pagePolicy } from "./pagePolicy";

afterEach(() => vi.unstubAllEnvs());

describe("pagePolicy", () => {
  it("carries the policy and a fresh nonce to the page, and puts the policy on the response", () => {
    const incoming = new Headers({ accept: "text/html" });
    const policy = pagePolicy(incoming, "http://localhost:3000/");
    const nonce = policy.headers.get("x-nonce")!;
    expect(policy.headers.get("Content-Security-Policy")).toContain(`'nonce-${nonce}'`);
    expect(policy.headers.get("accept")).toBe("text/html");
    expect(incoming.has("x-nonce")).toBe(false); // the caller's headers are not changed
    const response = new Response("page");
    policy.attach(response);
    expect(response.headers.get("Content-Security-Policy")).toContain(`'nonce-${nonce}'`);
    expect(pagePolicy(incoming, "http://localhost:3000/").headers.get("x-nonce")).not.toBe(nonce);
  });

  it("uses the report-only header in report-only mode, and adds nothing when off", () => {
    vi.stubEnv("CSP_MODE", "report-only");
    const reporting = pagePolicy(new Headers(), "http://localhost:3000/");
    const response = new Response("page");
    reporting.attach(response);
    expect(response.headers.get("Content-Security-Policy")).toBeNull();
    expect(response.headers.get("Content-Security-Policy-Report-Only")).not.toBeNull();

    vi.stubEnv("CSP_MODE", "off");
    const off = pagePolicy(new Headers(), "http://localhost:3000/");
    const plain = new Response("page");
    off.attach(plain);
    expect(off.headers.has("x-nonce")).toBe(false);
    expect([...plain.headers.keys()].some((key) => key.startsWith("content-security"))).toBe(false);
  });

  it("asks for the https upgrade only when the page came over https", () => {
    const plain = pagePolicy(new Headers(), "http://localhost:3000/");
    expect(plain.headers.get("Content-Security-Policy")).not.toContain("upgrade-insecure-requests");
    const secure = pagePolicy(new Headers(), "https://virello.example/");
    expect(secure.headers.get("Content-Security-Policy")).toContain("upgrade-insecure-requests");
    const behindProxy = pagePolicy(
      new Headers({ "x-forwarded-proto": "https" }),
      "http://web:3000/",
    );
    expect(behindProxy.headers.get("Content-Security-Policy")).toContain(
      "upgrade-insecure-requests",
    );
  });
});

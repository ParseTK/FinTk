import { afterEach, describe, expect, it, vi } from "vitest";
import { pagePolicy } from "./pagePolicy";

afterEach(() => vi.unstubAllEnvs());

describe("pagePolicy", () => {
  it("carries the policy and a fresh nonce to the page, and puts the policy on the response", () => {
    const incoming = new Headers({ accept: "text/html" });
    const policy = pagePolicy(incoming);
    const nonce = policy.headers.get("x-nonce")!;
    expect(policy.headers.get("Content-Security-Policy")).toContain(`'nonce-${nonce}'`);
    expect(policy.headers.get("accept")).toBe("text/html");
    expect(incoming.has("x-nonce")).toBe(false); // the caller's headers are not changed
    const response = new Response("page");
    policy.attach(response);
    expect(response.headers.get("Content-Security-Policy")).toContain(`'nonce-${nonce}'`);
    expect(pagePolicy(incoming).headers.get("x-nonce")).not.toBe(nonce);
  });

  it("uses the report-only header in report-only mode, and adds nothing when off", () => {
    vi.stubEnv("CSP_MODE", "report-only");
    const reporting = pagePolicy(new Headers());
    const response = new Response("page");
    reporting.attach(response);
    expect(response.headers.get("Content-Security-Policy")).toBeNull();
    expect(response.headers.get("Content-Security-Policy-Report-Only")).not.toBeNull();

    vi.stubEnv("CSP_MODE", "off");
    const off = pagePolicy(new Headers());
    const plain = new Response("page");
    off.attach(plain);
    expect(off.headers.has("x-nonce")).toBe(false);
    expect([...plain.headers.keys()].some((key) => key.startsWith("content-security"))).toBe(false);
  });
});

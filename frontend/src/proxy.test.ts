import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { config, proxy } from "./proxy";

afterEach(() => vi.unstubAllEnvs());

const request = () => new NextRequest("http://localhost:3000/design");

describe("proxy", () => {
  it("rewrites /design to a missing path (a real 404) while the flag is off", () => {
    const response = proxy(request());
    expect(response.headers.get("x-middleware-rewrite")).toContain("/design-is-disabled");
  });

  it("lets the request through when the flag is on", () => {
    vi.stubEnv("FEATURE_DESIGN", "true");
    const response = proxy(request());
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("only runs for /design", () => {
    expect(config.matcher).toEqual(["/design", "/design/:path*"]);
  });
});

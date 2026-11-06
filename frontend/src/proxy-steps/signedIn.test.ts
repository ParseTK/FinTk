import { describe, expect, it } from "vitest";
import { needsSignIn, signInUrl } from "./signedIn";

const jar = (...names: string[]) => ({ has: (name: string) => names.includes(name) });

describe("needsSignIn", () => {
  it.each(["/holdings", "/holdings/watchlist", "/account"])(
    "sends a visitor with no session cookie away from %s",
    (path) => expect(needsSignIn(path, jar())).toBe(true),
  );

  it("lets a visitor with either session cookie through to the page's own check", () => {
    expect(needsSignIn("/holdings", jar("fintk_session"))).toBe(false);
    expect(needsSignIn("/account", jar("__Host-fintk_session"))).toBe(false);
  });

  it("leaves public pages alone, and does not match a similar name", () => {
    expect(needsSignIn("/crypto", jar())).toBe(false);
    expect(needsSignIn("/holdings-guide", jar())).toBe(false);
    expect(needsSignIn("/", jar())).toBe(false);
  });
});

describe("signInUrl", () => {
  it("returns to the page the person was going to", () => {
    const url = signInUrl("http://localhost:3000/holdings/watchlist", "/holdings/watchlist");
    expect(url.pathname).toBe("/sign-in");
    expect(url.searchParams.get("next")).toBe("/holdings/watchlist");
    expect(url.origin).toBe("http://localhost:3000");
  });
});

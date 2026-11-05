import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safeRedirect";

describe("safeNextPath", () => {
  it.each(["/", "/account", "/company/AAPL", "/search?q=apple", "/a/b#section"])(
    "keeps the same-site path %s",
    (value) => {
      expect(safeNextPath(value)).toBe(value);
    },
  );

  it.each([
    undefined,
    "",
    "https://evil.example",
    "http://evil.example/x",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "evil.example",
    "relative",
    "/ok\r\nSet-Cookie: x=y",
    "/ok\u0000",
    `/${"a".repeat(300)}`,
  ])("falls back for %j", (value) => {
    expect(safeNextPath(value)).toBe("/");
    expect(safeNextPath(value, "/home")).toBe("/home");
  });

  it("uses the first value when the parameter is repeated", () => {
    expect(safeNextPath(["/first", "https://evil.example"])).toBe("/first");
    expect(safeNextPath(["https://evil.example", "/second"])).toBe("/");
  });
});

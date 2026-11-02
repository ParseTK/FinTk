import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { isEnabled } = await import("./flags");

describe("isEnabled", () => {
  it("is off by default", () => {
    expect(isEnabled("news", {})).toBe(false);
  });

  it.each(["true", "TRUE", "1", "on", " yes "])("turns on for %j", (value) => {
    expect(isEnabled("news", { FEATURE_NEWS: value })).toBe(true);
  });

  it.each(["false", "0", "off", "", "nope"])("stays off for %j", (value) => {
    expect(isEnabled("news", { FEATURE_NEWS: value })).toBe(false);
  });
});

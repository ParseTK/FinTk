import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FLAGS, flagEnvName, isEnabled, type FlagName } from "./flags";

const names = Object.keys(FLAGS) as FlagName[];
const offByDefault = names.filter((name) => !FLAGS[name].default);
const onByDefault = names.filter((name) => FLAGS[name].default);

describe("isEnabled", () => {
  it.each(offByDefault)("%s is off by default", (flag) => {
    expect(isEnabled(flag, {})).toBe(false);
  });

  it.each(onByDefault)("%s is on by default", (flag) => {
    expect(isEnabled(flag, {})).toBe(true);
  });

  it.each(["true", "TRUE", "1", "on", " yes "])("turns on for %j", (value) => {
    expect(isEnabled("crypto_news", { FEATURE_CRYPTO_NEWS: value })).toBe(true);
  });

  it.each(["false", "0", "off", "", "nope"])("turns off for %j", (value) => {
    expect(isEnabled("scroll_motion", { FEATURE_SCROLL_MOTION: value })).toBe(false);
  });

  it("only changes the flag it names", () => {
    const env = { FEATURE_PALETTE: "false" };
    expect(isEnabled("palette", env)).toBe(false);
    expect(isEnabled("scroll_motion", env)).toBe(true);
  });
});

describe("flagEnvName", () => {
  it("is FEATURE_ plus the upper-case name", () => {
    expect(flagEnvName("scroll_motion")).toBe("FEATURE_SCROLL_MOTION");
    expect(flagEnvName("crypto_news")).toBe("FEATURE_CRYPTO_NEWS");
  });
});

describe("registry", () => {
  it("describes every flag", () => {
    for (const name of names) expect(FLAGS[name].description.length).toBeGreaterThan(10);
  });

  it("documents every flag in .env.example", () => {
    const example = readFileSync(resolve(process.cwd(), ".env.example"), "utf8");
    for (const name of names) expect(example, flagEnvName(name)).toContain(flagEnvName(name));
  });
});

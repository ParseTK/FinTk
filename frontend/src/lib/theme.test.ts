import { afterEach, describe, expect, it, vi } from "vitest";
import { parseTheme, resolveDark, THEME_INIT_SCRIPT, THEME_STORAGE_KEY } from "./theme";

describe("parseTheme", () => {
  it("accepts light and dark, and falls back to system", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("system")).toBe("system");
    expect(parseTheme("purple")).toBe("system");
    expect(parseTheme(null)).toBe("system");
  });
});

describe("resolveDark", () => {
  it("follows the OS only for system", () => {
    expect(resolveDark("system", true)).toBe(true);
    expect(resolveDark("system", false)).toBe(false);
    expect(resolveDark("dark", false)).toBe(true);
    expect(resolveDark("light", true)).toBe(false);
  });
});

describe("THEME_INIT_SCRIPT", () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    vi.unstubAllGlobals();
  });

  function run(stored: string | null, systemDark: boolean) {
    if (stored !== null) localStorage.setItem(THEME_STORAGE_KEY, stored);
    vi.stubGlobal("matchMedia", () => ({ matches: systemDark }));
    new Function(THEME_INIT_SCRIPT)();
    return document.documentElement.classList.contains("dark");
  }

  // The inline script must agree with resolveDark(parseTheme(...)) for every input.
  it.each([null, "system", "light", "dark", "garbage"])(
    "matches resolveDark for stored=%j",
    (stored) => {
      for (const systemDark of [true, false]) {
        document.documentElement.classList.remove("dark");
        localStorage.clear();
        expect(run(stored, systemDark)).toBe(resolveDark(parseTheme(stored), systemDark));
      }
    },
  );
});

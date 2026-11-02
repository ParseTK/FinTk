import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACCENTS,
  applyPreferences,
  DEFAULT_PREFERENCES,
  FONTS,
  parseAccent,
  parseFont,
  parseMode,
  PREFERENCES_INIT_SCRIPT,
  readPreferences,
  resolveMode,
  STORAGE_KEYS,
} from "./preferences";

describe("parsers", () => {
  it("accept known ids and fall back to the defaults", () => {
    expect(parseMode("dark")).toBe("dark");
    expect(parseMode("light")).toBe("light");
    expect(parseMode("purple")).toBeNull();
    expect(parseMode("system")).toBeNull(); // retired option from earlier versions
    expect(parseMode(null)).toBeNull();
    expect(parseAccent("rose")).toBe("rose");
    expect(parseAccent("neon")).toBe(DEFAULT_PREFERENCES.accent);
    expect(parseFont("serif")).toBe("serif");
    expect(parseFont("comic")).toBe(DEFAULT_PREFERENCES.font);
  });
});

describe("resolveMode", () => {
  it("uses the saved choice, otherwise the device setting", () => {
    expect(resolveMode(null, true)).toBe("dark");
    expect(resolveMode(null, false)).toBe("light");
    expect(resolveMode("dark", false)).toBe("dark");
    expect(resolveMode("light", true)).toBe("light");
  });
});

describe("pre-paint init script (static literal)", () => {
  it("repeats every storage key, accent and typeface from the constants", () => {
    for (const key of Object.values(STORAGE_KEYS)) {
      expect(PREFERENCES_INIT_SCRIPT).toContain(`"${key}"`);
    }
    const accentList = `[${ACCENTS.map((a) => `"${a.id}"`).join(",")}]`;
    const fontList = `[${FONTS.map((f) => `"${f.id}"`).join(",")}]`;
    expect(PREFERENCES_INIT_SCRIPT).toContain(accentList);
    expect(PREFERENCES_INIT_SCRIPT).toContain(fontList);
    expect(PREFERENCES_INIT_SCRIPT).toContain(`:"${DEFAULT_PREFERENCES.accent}"`);
    expect(PREFERENCES_INIT_SCRIPT).toContain(`:"${DEFAULT_PREFERENCES.font}"`);
  });
});

describe("pre-paint init script", () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    delete document.documentElement.dataset.accent;
    delete document.documentElement.dataset.font;
    vi.unstubAllGlobals();
  });

  function runScript(stored: Record<string, string>, systemDark: boolean) {
    localStorage.clear();
    for (const [key, value] of Object.entries(stored)) localStorage.setItem(key, value);
    vi.stubGlobal("matchMedia", () => ({ matches: systemDark }));
    new Function(PREFERENCES_INIT_SCRIPT)();
    const root = document.documentElement;
    return {
      dark: root.classList.contains("dark"),
      accent: root.dataset.accent,
      font: root.dataset.font,
    };
  }

  // The inline script and applyPreferences must produce the same result for every input.
  const modes = [undefined, "system", "light", "dark", "garbage"];
  const accents = [undefined, ...ACCENTS.map((a) => a.id), "garbage"];
  const fonts = [undefined, ...FONTS.map((f) => f.id), "garbage"];

  it.each(modes)("matches applyPreferences for stored mode=%s", (mode) => {
    for (const accent of accents) {
      for (const font of fonts) {
        for (const systemDark of [true, false]) {
          const stored: Record<string, string> = {};
          if (mode) stored[STORAGE_KEYS.mode] = mode;
          if (accent) stored[STORAGE_KEYS.accent] = accent;
          if (font) stored[STORAGE_KEYS.font] = font;

          const fromScript = runScript(stored, systemDark);

          document.documentElement.classList.remove("dark");
          vi.stubGlobal("matchMedia", () => ({ matches: systemDark }));
          const prefs = readPreferences();
          applyPreferences(prefs);
          expect(fromScript).toEqual({
            dark: document.documentElement.classList.contains("dark"),
            accent: prefs.accent,
            font: prefs.font,
          });
        }
      }
    }
  });
});

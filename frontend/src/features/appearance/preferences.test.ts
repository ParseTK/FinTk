import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACCENTS,
  applyPreferences,
  DEFAULT_PREFERENCES,
  FONTS,
  MOTIONS,
  parseAccent,
  parseFont,
  parseMode,
  parseMotion,
  PREFERENCES_INIT_SCRIPT,
  readPreferences,
  resolveMode,
  resolveMotion,
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
    expect(parseMotion("reduced")).toBe("reduced");
    expect(parseMotion("full")).toBe("full");
    expect(parseMotion("slow")).toBeNull();
    expect(parseMotion(null)).toBeNull();
  });
});

describe("resolveMode", () => {
  it("uses the saved choice, otherwise dark: the device setting does not decide the theme", () => {
    expect(resolveMode(null)).toBe("dark");
    expect(resolveMode("dark")).toBe("dark");
    expect(resolveMode("light")).toBe("light");
  });
});

describe("resolveMotion", () => {
  it("uses the saved choice, otherwise the device setting", () => {
    expect(resolveMotion(null, true)).toBe("reduced");
    expect(resolveMotion(null, false)).toBe("full");
    expect(resolveMotion("full", true)).toBe("full");
    expect(resolveMotion("reduced", false)).toBe("reduced");
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
    for (const { id } of MOTIONS) expect(PREFERENCES_INIT_SCRIPT).toContain(`"${id}"`);
    expect(PREFERENCES_INIT_SCRIPT).toContain(fontList);
    expect(PREFERENCES_INIT_SCRIPT).toContain(`:"${DEFAULT_PREFERENCES.accent}"`);
    expect(PREFERENCES_INIT_SCRIPT).toContain(`:"${DEFAULT_PREFERENCES.font}"`);
  });
});

describe("pre-paint init script", () => {
  afterEach(() => {
    localStorage.clear();
    const root = document.documentElement;
    root.classList.remove("dark");
    delete root.dataset.accent;
    delete root.dataset.font;
    delete root.dataset.motion;
    vi.unstubAllGlobals();
  });

  /** Each media query answers independently: dark scheme and reduced motion. */
  function stubDevice(systemDark: boolean, systemReduced: boolean) {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("prefers-color-scheme") ? systemDark : systemReduced,
    }));
  }

  function snapshot() {
    const root = document.documentElement;
    return {
      dark: root.classList.contains("dark"),
      accent: root.dataset.accent,
      font: root.dataset.font,
      motion: root.dataset.motion,
    };
  }

  function runScript(stored: Record<string, string>, systemDark: boolean, systemReduced: boolean) {
    localStorage.clear();
    for (const [key, value] of Object.entries(stored)) localStorage.setItem(key, value);
    stubDevice(systemDark, systemReduced);
    new Function(PREFERENCES_INIT_SCRIPT)();
    return snapshot();
  }

  // The inline script and applyPreferences must produce the same result for every input.
  const modes = [undefined, "system", "light", "dark", "garbage"];
  const accents = [undefined, ...ACCENTS.map((a) => a.id), "garbage"];
  const fonts = [undefined, ...FONTS.map((f) => f.id), "garbage"];
  const motions = [undefined, ...MOTIONS.map((m) => m.id), "garbage"];

  it.each(modes)("matches applyPreferences for stored mode=%s", (mode) => {
    for (const accent of accents) {
      for (const font of fonts) {
        for (const motion of motions) {
          for (const systemDark of [true, false]) {
            for (const systemReduced of [true, false]) {
              const stored: Record<string, string> = {};
              if (mode) stored[STORAGE_KEYS.mode] = mode;
              if (accent) stored[STORAGE_KEYS.accent] = accent;
              if (font) stored[STORAGE_KEYS.font] = font;
              if (motion) stored[STORAGE_KEYS.motion] = motion;

              const fromScript = runScript(stored, systemDark, systemReduced);

              document.documentElement.classList.remove("dark");
              stubDevice(systemDark, systemReduced);
              const prefs = readPreferences();
              applyPreferences(prefs);
              expect(fromScript).toEqual(snapshot());
              expect(fromScript.motion).toBe(prefs.motion);
            }
          }
        }
      }
    }
  });
});

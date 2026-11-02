/** Appearance preferences: mode (light/dark/system), accent color and typeface. */

export const MODES = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
] as const;

export const ACCENTS = [
  { id: "blue", label: "Blue" },
  { id: "violet", label: "Violet" },
  { id: "emerald", label: "Emerald" },
  { id: "rose", label: "Rose" },
] as const;

/** `cssVar` is the next/font variable set in the root layout. */
export const FONTS = [
  { id: "inter", label: "Inter", cssVar: "--font-inter" },
  { id: "plex", label: "IBM Plex Sans", cssVar: "--font-plex" },
  { id: "serif", label: "Source Serif 4", cssVar: "--font-source-serif" },
] as const;

export type Mode = (typeof MODES)[number]["id"];
export type Accent = (typeof ACCENTS)[number]["id"];
export type FontId = (typeof FONTS)[number]["id"];

export interface Preferences {
  mode: Mode;
  accent: Accent;
  font: FontId;
}

export const DEFAULT_PREFERENCES: Preferences = { mode: "system", accent: "blue", font: "inter" };

export const STORAGE_KEYS = { mode: "theme", accent: "accent", font: "font" } as const;

const MODE_IDS: readonly string[] = MODES.map((m) => m.id);
const ACCENT_IDS: readonly string[] = ACCENTS.map((a) => a.id);
const FONT_IDS: readonly string[] = FONTS.map((f) => f.id);

export function parseMode(value: string | null | undefined): Mode {
  return MODE_IDS.includes(value ?? "") ? (value as Mode) : DEFAULT_PREFERENCES.mode;
}
export function parseAccent(value: string | null | undefined): Accent {
  return ACCENT_IDS.includes(value ?? "") ? (value as Accent) : DEFAULT_PREFERENCES.accent;
}
export function parseFont(value: string | null | undefined): FontId {
  return FONT_IDS.includes(value ?? "") ? (value as FontId) : DEFAULT_PREFERENCES.font;
}

export function resolveDark(mode: Mode, systemPrefersDark: boolean): boolean {
  return mode === "dark" || (mode === "system" && systemPrefersDark);
}

/** Reads saved preferences. Safe to call only in the browser. */
export function readPreferences(storage: Pick<Storage, "getItem"> = localStorage): Preferences {
  return {
    mode: parseMode(storage.getItem(STORAGE_KEYS.mode)),
    accent: parseAccent(storage.getItem(STORAGE_KEYS.accent)),
    font: parseFont(storage.getItem(STORAGE_KEYS.font)),
  };
}

/** Applies preferences to <html>. Safe to call only in the browser. */
export function applyPreferences(prefs: Preferences, root: HTMLElement = document.documentElement) {
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  root.classList.toggle("dark", resolveDark(prefs.mode, systemDark));
  root.dataset.accent = prefs.accent;
  root.dataset.font = prefs.font;
}

/**
 * Runs in <head> before first paint so the page never flashes the wrong look.
 * A plain string literal on purpose: no code is built from values at runtime, so nothing can be
 * injected into it. The ids and storage keys are repeated here, and tests fail if they drift from
 * the constants above.
 */
export const PREFERENCES_INIT_SCRIPT =
  '(function(){try{var d=document.documentElement,s=localStorage,t=s.getItem("theme"),a=s.getItem("accent"),f=s.getItem("font");d.classList.toggle("dark",t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches));d.dataset.accent=["blue","violet","emerald","rose"].indexOf(a)>-1?a:"blue";d.dataset.font=["inter","plex","serif"].indexOf(f)>-1?f:"inter"}catch(e){}})()';

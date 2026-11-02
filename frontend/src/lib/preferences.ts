/**
 * Appearance preferences: mode (light or dark), accent color and typeface.
 * Until the visitor picks a mode, it follows their device setting; there is no "system" option.
 */

export const MODES = [
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

/** Server-side default. In the browser an unset mode resolves from the device setting instead. */
export const DEFAULT_PREFERENCES: Preferences = { mode: "light", accent: "blue", font: "inter" };

export const STORAGE_KEYS = { mode: "theme", accent: "accent", font: "font" } as const;

const MODE_IDS: readonly string[] = MODES.map((m) => m.id);
const ACCENT_IDS: readonly string[] = ACCENTS.map((a) => a.id);
const FONT_IDS: readonly string[] = FONTS.map((f) => f.id);

/** Returns null when nothing valid is stored (including the retired "system" value). */
export function parseMode(value: string | null | undefined): Mode | null {
  return MODE_IDS.includes(value ?? "") ? (value as Mode) : null;
}
export function parseAccent(value: string | null | undefined): Accent {
  return ACCENT_IDS.includes(value ?? "") ? (value as Accent) : DEFAULT_PREFERENCES.accent;
}
export function parseFont(value: string | null | undefined): FontId {
  return FONT_IDS.includes(value ?? "") ? (value as FontId) : DEFAULT_PREFERENCES.font;
}

/** A saved choice wins; otherwise follow the device setting. */
export function resolveMode(stored: Mode | null, systemPrefersDark: boolean): Mode {
  return stored ?? (systemPrefersDark ? "dark" : "light");
}

/** Reads saved preferences (mode already resolved). Safe to call only in the browser. */
export function readPreferences(
  storage: Pick<Storage, "getItem"> = localStorage,
  systemPrefersDark: boolean = window.matchMedia("(prefers-color-scheme: dark)").matches,
): Preferences {
  return {
    mode: resolveMode(parseMode(storage.getItem(STORAGE_KEYS.mode)), systemPrefersDark),
    accent: parseAccent(storage.getItem(STORAGE_KEYS.accent)),
    font: parseFont(storage.getItem(STORAGE_KEYS.font)),
  };
}

/** Applies preferences to <html>. Safe to call only in the browser. */
export function applyPreferences(prefs: Preferences, root: HTMLElement = document.documentElement) {
  root.classList.toggle("dark", prefs.mode === "dark");
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

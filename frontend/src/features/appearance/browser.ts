/** Preferences in the browser: reading what is saved in localStorage and applying it to <html>. */
import { STORAGE_KEYS, type Preferences } from "./options";
import {
  parseAccent,
  parseFont,
  parseMode,
  parseMotion,
  resolveMode,
  resolveMotion,
} from "./parse";

/** Reads saved preferences (mode and motion already resolved). Safe to call only in the browser. */
export function readPreferences(
  storage: Pick<Storage, "getItem"> = localStorage,
  systemPrefersReducedMotion: boolean = window.matchMedia("(prefers-reduced-motion: reduce)")
    .matches,
): Preferences {
  return {
    mode: resolveMode(parseMode(storage.getItem(STORAGE_KEYS.mode))),
    accent: parseAccent(storage.getItem(STORAGE_KEYS.accent)),
    font: parseFont(storage.getItem(STORAGE_KEYS.font)),
    motion: resolveMotion(
      parseMotion(storage.getItem(STORAGE_KEYS.motion)),
      systemPrefersReducedMotion,
    ),
  };
}

/** Applies preferences to <html>. Safe to call only in the browser. */
export function applyPreferences(prefs: Preferences, root: HTMLElement = document.documentElement) {
  root.classList.toggle("dark", prefs.mode === "dark");
  root.dataset.accent = prefs.accent;
  root.dataset.font = prefs.font;
  root.dataset.motion = prefs.motion;
}

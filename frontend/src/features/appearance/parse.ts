/** Reading a stored value back safely: anything that is not a known option falls back, never throws. */
import {
  ACCENTS,
  DEFAULT_PREFERENCES,
  FONTS,
  MODES,
  MOTIONS,
  type Accent,
  type FontId,
  type Mode,
  type Motion,
} from "./options";

const MODE_IDS: readonly string[] = MODES.map((m) => m.id);
const ACCENT_IDS: readonly string[] = ACCENTS.map((a) => a.id);
const FONT_IDS: readonly string[] = FONTS.map((f) => f.id);
const MOTION_IDS: readonly string[] = MOTIONS.map((m) => m.id);

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

/** Returns null when nothing valid is stored. */
export function parseMotion(value: string | null | undefined): Motion | null {
  return MOTION_IDS.includes(value ?? "") ? (value as Motion) : null;
}

/** A saved choice wins; otherwise the default (dark), not the device setting. */
export function resolveMode(stored: Mode | null): Mode {
  return stored ?? DEFAULT_PREFERENCES.mode;
}

export function resolveMotion(stored: Motion | null, systemPrefersReducedMotion: boolean): Motion {
  return stored ?? (systemPrefersReducedMotion ? "reduced" : "full");
}

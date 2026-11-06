/**
 * The appearance options and what a first-time visitor gets: mode (light or dark), accent color,
 * typeface and motion. Adding an accent or a typeface changes this file and no other.
 * Until the visitor picks a mode it is dark, whatever their device prefers; there is no "system"
 * option. Motion still follows the device until chosen (an accessibility setting, not a style).
 */

export const MODES = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
] as const;

/** The first accent is the one a visitor gets until they choose another. */
export const ACCENTS = [
  { id: "gold", label: "Gold" },
  { id: "mint", label: "Mint" },
  { id: "pink", label: "Pink" },
  { id: "blue", label: "Blue" },
  { id: "violet", label: "Violet" },
  { id: "rose", label: "Rose" },
] as const;

/** `cssVar` is the next/font variable set in the root layout. */
export const FONTS = [
  { id: "inter", label: "Inter", cssVar: "--font-inter" },
  { id: "plex", label: "IBM Plex Sans", cssVar: "--font-plex" },
  { id: "serif", label: "Source Serif 4", cssVar: "--font-source-serif" },
] as const;

/** Motion is a first-class accessibility control: "reduced" stops all animation site-wide. */
export const MOTIONS = [
  { id: "full", label: "Full" },
  { id: "reduced", label: "Reduced" },
] as const;

export type Mode = (typeof MODES)[number]["id"];
export type Accent = (typeof ACCENTS)[number]["id"];
export type FontId = (typeof FONTS)[number]["id"];
export type Motion = (typeof MOTIONS)[number]["id"];

export interface Preferences {
  mode: Mode;
  accent: Accent;
  font: FontId;
  motion: Motion;
}

/** What a first-time visitor gets. Only an unset motion resolves from the device setting instead. */
export const DEFAULT_PREFERENCES: Preferences = {
  mode: "dark",
  accent: "gold",
  font: "inter",
  motion: "full",
};

export const STORAGE_KEYS = {
  mode: "theme",
  accent: "accent",
  font: "font",
  motion: "motion",
} as const;

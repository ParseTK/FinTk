import "server-only";

/**
 * Feature flags. Every flag defaults to off, so unfinished work can merge to main without
 * changing the user experience. Turn one on per environment with FEATURE_<NAME>=true.
 * Read at request time on the server (not inlined at build), so one image serves every environment.
 */
const DEFAULTS = {
  news: false,
} as const;

export type FlagName = keyof typeof DEFAULTS;

const TRUTHY = new Set(["1", "true", "on", "yes"]);

export function isEnabled(
  flag: FlagName,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const raw = env[`FEATURE_${flag.toUpperCase()}`];
  if (raw === undefined) return DEFAULTS[flag];
  return TRUTHY.has(raw.trim().toLowerCase());
}

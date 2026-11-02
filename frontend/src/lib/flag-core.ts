/**
 * Feature flags, read on the server at request time (the root layout is dynamic, so a changed
 * environment variable takes effect without a rebuild).
 *
 * Two kinds:
 *  - New or unfinished features default to OFF and are turned on with FEATURE_<NAME>=true.
 *  - Shipped features that we expect to keep reworking default to ON and act as kill switches:
 *    FEATURE_<NAME>=false swaps in a simpler fallback (or hides the piece) so the site stays usable
 *    while that feature is worked on.
 *
 * Add every new flag here and to .env.example (a test enforces the second part).
 */
export const FLAGS = {
  design: {
    default: false,
    description: "Component gallery at /design (internal review page; hidden and not indexed).",
  },
  news: {
    default: false,
    description: "News section and nav link (not built yet).",
  },
  hero_chart: {
    default: true,
    description:
      "Animated, scrubbable chart in the hero. Off: the hero text is centered without it.",
  },
  rich_search: {
    default: true,
    description:
      "Enhanced search field (glow, rotating hints, / shortcut). Off: a plain, fully working form.",
  },
  palette: {
    default: true,
    description:
      "Appearance palette in the nav. Off: the picker is hidden; saved choices still apply.",
  },
  scroll_motion: {
    default: true,
    description:
      "Scroll-driven reveal, parallax depth and drawn illustrations in the feature section. Off: a plain static section.",
  },
  market_ticker: {
    default: true,
    description: "Sample market ticker strip on the home page.",
  },
} as const satisfies Record<string, { default: boolean; description: string }>;

export type FlagName = keyof typeof FLAGS;

const TRUTHY = new Set(["1", "true", "on", "yes"]);

export function flagEnvName(flag: FlagName): string {
  return `FEATURE_${flag.toUpperCase()}`;
}

export function isEnabled(
  flag: FlagName,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const raw = env[flagEnvName(flag)];
  if (raw === undefined) return FLAGS[flag].default;
  return TRUTHY.has(raw.trim().toLowerCase());
}

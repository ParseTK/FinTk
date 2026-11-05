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
 * A flag whose feature is finished, or removed, is deleted (with its fallback), not kept.
 * Add every new flag here and to .env.example (a test enforces the second part).
 */
export const FLAGS = {
  design: {
    default: false,
    description: "Component gallery at /design (internal review page; hidden and not indexed).",
  },
  auth: {
    default: false,
    description:
      "Sign in with Google or GitHub: header menu, /sign-in, /account and the /api sign-in proxy. Off: none of it is reachable.",
  },
  crypto: {
    default: false,
    description:
      "The crypto pages: /crypto and its header link, with top coins, market totals and Fear and Greed from CoinMarketCap (needs a key and the internal token on the API). Off: the landing page shows no live data.",
  },
  // Depends on: crypto (the page and its sidebar link need both flags on).
  crypto_markets: {
    default: false,
    description:
      "The /crypto/markets page and its sidebar link: the market make-up, and how the ten largest coins have done over 30 days to a year. Needs the crypto flag too.",
  },
  // Depends on: crypto (the page and its sidebar link need both flags on).
  crypto_news: {
    default: false,
    description:
      "The /crypto/news page and its sidebar link: official SEC, CFTC and Department of Justice announcements about crypto, and SEC filings of a printed list of crypto companies. Needs the crypto flag too.",
  },
  // Depends on: crypto (the search box, the search page and the coin pages need both flags on).
  crypto_search: {
    default: false,
    description:
      "Search for a coin by name or symbol (header box with suggestions, and /crypto/search), and a page for each coin at /crypto/coins/<name>. Needs the crypto flag too.",
  },
  palette: {
    default: true,
    description:
      "Appearance palette in the nav. Off: the picker is hidden; saved choices still apply.",
  },
  scroll_motion: {
    default: true,
    description: "Scroll-driven parallax depth in the landing hero. Off: a plain static hero.",
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

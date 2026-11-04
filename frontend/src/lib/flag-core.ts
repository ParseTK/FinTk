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
  app_shell: {
    default: false,
    description:
      "The new app shell: a sidebar of subpages beside the pages of a section that has several (Holdings, Crypto, Markets). Off: the plain header-only layout.",
  },
  design: {
    default: false,
    description: "Component gallery at /design (internal review page; hidden and not indexed).",
  },
  auth: {
    default: false,
    description:
      "Sign in with Google or GitHub: header menu, /sign-in, /account and the /api sign-in proxy. Off: none of it is reachable.",
  },
  portfolio_v2: {
    default: false,
    description:
      "New portfolio page: '+ Add purchase' panel with batch rows, holdings cards on phones, allocation chart. Off: the current page.",
  },
  valuation: {
    default: false,
    description:
      "Portfolio value, gain or loss and latest prices (needs a price provider key on the API).",
  },
  markets: {
    default: false,
    description:
      "The /markets page and its nav link: index and sector performance from month-end closes (ETF proxies).",
  },
  // Depends on: crypto (the page and its nav link need both flags on).
  crypto_markets: {
    default: false,
    description:
      "The /crypto/markets page and its nav link: the market make-up, and how the ten largest coins have done over 30 days to a year. Needs the crypto flag too.",
  },
  // Depends on: crypto (the page and its nav link need both flags on).
  crypto_news: {
    default: false,
    description:
      "The /crypto/news page and its nav link: official SEC, CFTC and Department of Justice announcements about crypto, and SEC filings of a printed list of crypto companies. Needs the crypto flag too.",
  },
  // Depends on: crypto (the switch only shows while the crypto section is on).
  mode_switch: {
    default: false,
    description:
      "A Crypto | Stocks switch in the header. Crypto is the default; each mode shows its own links and the home page follows the mode. Needs the crypto flag too.",
  },
  ratios: {
    default: false,
    description:
      "A Ratios card on the company page (margins, growth, return on equity and similar) worked out from the company's SEC filings.",
  },
  crypto: {
    default: false,
    description:
      "The /crypto page and its nav link: top coins, market totals and Fear and Greed from CoinMarketCap (needs a key and the internal token on the API).",
  },
  seasonality: {
    default: false,
    description:
      "Month-by-year returns on the company page (price history comes from the API; sample data is labelled).",
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

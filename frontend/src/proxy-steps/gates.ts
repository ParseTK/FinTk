import { isEnabled, type FlagName } from "@/lib/flag-core";

/** Pages that exist only while the feature flags behind them are on. */
const GATED_PAGES: ReadonlyArray<readonly [prefix: string, flag: FlagName]> = [
  ["/design", "design"],
  ["/resources", "resources"],
  ["/crypto", "crypto"],
  ["/crypto/markets", "crypto_markets"],
  ["/crypto/news", "crypto_news"],
  ["/crypto/search", "crypto_search"],
  ["/crypto/coins", "crypto_search"],
  ["/sign-in", "auth"],
  ["/account", "auth"],
  // The holdings pages need prices (crypto), a person (auth) and their own flag.
  ["/holdings", "crypto"],
  ["/holdings", "auth"],
  ["/holdings", "holdings"],
];

export const isUnder = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

/**
 * Whether a feature flag keeps this page switched off. Every gate that matches must be open:
 * /crypto/markets needs both the crypto and the crypto_markets flags, so turning the markets page
 * on never opens it while the crypto page itself is off.
 */
export function isGatedOff(pathname: string): boolean {
  return GATED_PAGES.some(([prefix, flag]) => isUnder(pathname, prefix) && !isEnabled(flag));
}

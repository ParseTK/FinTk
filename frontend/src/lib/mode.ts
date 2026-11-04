/**
 * The two ways to use Virello: Crypto (prices and market mood) and Stocks (company research from SEC
 * filings). The choice is remembered in a cookie so the server can render the right navigation on
 * the first paint, with no flash. Pure helpers only (no framework imports), shared by server and
 * client code.
 */
export const MODES = ["crypto", "stocks"] as const;
export type Mode = (typeof MODES)[number];

/** What a first-time visitor sees. Crypto first, by decision. */
export const DEFAULT_MODE: Mode = "crypto";

export const MODE_COOKIE = "virello_mode";
/** One year, in seconds. */
export const MODE_MAX_AGE = 365 * 24 * 60 * 60;

export const MODE_LABELS: Record<Mode, string> = { crypto: "Crypto", stocks: "Stocks" };

export function isMode(value: unknown): value is Mode {
  return typeof value === "string" && (MODES as readonly string[]).includes(value);
}

/** A stored value, or the default when it is missing or not one of the known modes. */
export function parseMode(value: string | null | undefined): Mode {
  return isMode(value) ? value : DEFAULT_MODE;
}

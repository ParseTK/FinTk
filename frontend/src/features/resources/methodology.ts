/**
 * The text of the Data & methodology page, as plain data so it is easy to read, review and test.
 *
 * Every number here describes the API, so keep them in step with the code that sets them:
 * - cache lifetimes: backend/app/services/crypto.py (LISTINGS_TTL, TOTALS_TTL, FEAR_GREED_TTL,
 *   ANCHOR_TTL, STALE) and backend/app/services/news.py (NEWS_TTL)
 * - how many coins: TOP_N and FETCH_N in the same crypto.py
 * - news rules: backend/app/domain/crypto_news.py (the page's own news section prints the live
 *   word list, so this page does not repeat it)
 * - formulas: backend/app/domain/crypto_markets.py
 */

export interface SourceRow {
  name: string;
  href: string;
  provides: string;
  /** How old the copy Virello shows can be. */
  age: string;
}

export const SOURCES: readonly SourceRow[] = [
  {
    name: "CoinMarketCap",
    href: "https://coinmarketcap.com/",
    provides:
      "Coin prices, market capitalization, 24-hour trading volume, supply, reported price changes, market totals and the Fear and Greed index.",
    age: "Prices and totals up to 10 minutes. Fear and Greed up to 1 hour. The two prices behind year-to-date and past-year changes up to 12 hours.",
  },
  {
    name: "SEC",
    href: "https://www.sec.gov/newsroom/press-releases",
    provides:
      "Press releases, and Form 8-K filings from EDGAR for a short, fixed list of crypto companies.",
    age: "Up to 15 minutes.",
  },
  {
    name: "CFTC",
    href: "https://www.cftc.gov/PressRoom/PressReleases",
    provides: "Press releases and enforcement releases.",
    age: "Up to 15 minutes.",
  },
  {
    name: "U.S. Department of Justice",
    href: "https://www.justice.gov/news",
    provides: "Press releases.",
    age: "Up to 15 minutes.",
  },
];

export interface Figure {
  name: string;
  meaning: string;
}

export const FIGURES: readonly Figure[] = [
  {
    name: "Price, market cap, volume and supply",
    meaning:
      "Shown as CoinMarketCap reports them, in US dollars. Virello does not adjust, smooth or estimate them.",
  },
  {
    name: "Change over 24 hours, 7, 30 and 90 days (and 1 hour on a coin page)",
    meaning:
      "The change CoinMarketCap reports from the price at the start of the period to the price now. The bars start from a zero line and are drawn from these figures. There is no price history between the dates, so none is drawn.",
  },
  {
    name: "Year to date and past year",
    meaning:
      "Worked out by Virello from two prices: the price on 1 January (or about a year ago) and the price now, as (now − then) ÷ then × 100, rounded to two decimals. “About a year” is 358 days, the furthest back the free data plan allows safely. The dates used are printed in the table headings.",
  },
  {
    name: "Market make-up",
    meaning:
      "Bitcoin's and Ethereum's shares of the total market value are CoinMarketCap's. “All other coins” is 100 minus those two. The stablecoin and DeFi groups are counted among the coins above, so they overlap the rows beside them and must not be added to them.",
  },
  {
    name: "Largest gain and decline",
    meaning:
      "Of the 25 coins on the markets page, the one with the highest and the one with the lowest reported 24-hour change. It is a ranking of one day's move among large coins, not a recommendation.",
  },
  {
    name: "Fear and Greed",
    meaning:
      "A score and label calculated by CoinMarketCap. Virello shows them unchanged. How the score is built is explained in CoinMarketCap's own methodology.",
  },
  {
    name: "Your portfolio",
    meaning:
      "Value is the amount you entered times the current price. Paid is the total you entered, and gain or loss is value minus paid. Virello cannot check what you entered. A holding with no amount paid has no gain or loss.",
  },
];

export interface Limit {
  title: string;
  text: string;
}

export const LIMITS: readonly Limit[] = [
  {
    title: "Not live",
    text: "Prices can be up to about 10 minutes old. If a refresh fails, an older copy is shown for up to an hour, and the “updated” time on the page tells you how old it is. After that the page says the data is unavailable.",
  },
  {
    title: "Largest coins only",
    text: "Virello reads the 200 largest coins by market capitalization. The markets page lists 25 of them. Coin pages and search cover the 200. A smaller coin will not be found.",
  },
  {
    title: "No price history",
    text: "Only the change over each period is shown. There are no charts of daily prices, because the data plan does not include them.",
  },
  {
    title: "Missing means missing",
    text: "If a figure is not available, the page says so. It is never replaced with an estimate or an old value.",
  },
  {
    title: "US dollars only",
    text: "All prices and values are in US dollars.",
  },
  {
    title: "Temporary storage",
    text: "Market data is kept only briefly in memory to avoid asking the provider again. It is not archived. What you save, your holdings and watchlist, is stored with your account until you delete it.",
  },
  {
    title: "Information, not advice",
    text: "Virello is for personal, non-commercial research. Nothing on it is investment advice, and data can be delayed, incomplete or briefly unavailable.",
  },
];

/**
 * The text of the Source directory page, as plain data. Only publishers Virello itself reads are
 * listed, so "On Virello" is always true: it names the page that uses the source. Check that when a
 * source is added or a page stops using one.
 */

export interface SourceEntry {
  name: string;
  publisher: string;
  href: string;
  covers: string;
  onVirello: string;
}

export interface SourceGroup {
  id: string;
  title: string;
  intro: string;
  entries: readonly SourceEntry[];
}

export const SOURCE_GROUPS: readonly SourceGroup[] = [
  {
    id: "agencies",
    title: "Agency releases",
    intro: "Announcements from the agencies that regulate and prosecute, in their own words.",
    entries: [
      {
        name: "SEC press releases",
        publisher: "U.S. Securities and Exchange Commission",
        href: "https://www.sec.gov/newsroom/press-releases",
        covers: "Announcements of enforcement actions, rules and other agency news.",
        onVirello: "Read for the news page, kept when the headline mentions crypto.",
      },
      {
        name: "CFTC press releases",
        publisher: "Commodity Futures Trading Commission",
        href: "https://www.cftc.gov/PressRoom/PressReleases",
        covers: "Announcements about rules, enforcement and the oversight of derivatives markets.",
        onVirello: "Read for the news page, kept when the headline mentions crypto.",
      },
      {
        name: "CFTC enforcement",
        publisher: "Commodity Futures Trading Commission",
        href: "https://www.cftc.gov/LawRegulation/Enforcement/index.htm",
        covers: "The agency's enforcement work and the actions it has announced.",
        onVirello: "Its enforcement release feed is read for the news page.",
      },
      {
        name: "Justice Department press releases",
        publisher: "U.S. Department of Justice",
        href: "https://www.justice.gov/news/press-releases",
        covers: "Announcements of charges, pleas, sentences and settlements.",
        onVirello: "Read for the news page, kept when the headline mentions crypto.",
      },
    ],
  },
  {
    id: "filings",
    title: "Company filings",
    intro: "What listed companies must tell the public, filed with the SEC.",
    entries: [
      {
        name: "SEC EDGAR",
        publisher: "U.S. Securities and Exchange Commission",
        href: "https://www.sec.gov/edgar/search/",
        covers:
          "Every filing by US public companies. Search by company name or ticker, then filter by form type.",
        onVirello:
          "Form 8-K filings of a short, fixed list of crypto companies are shown on the news page.",
      },
    ],
  },
  {
    id: "market-data",
    title: "Market data",
    intro: "Prices and market figures, and how they are built.",
    entries: [
      {
        name: "CoinMarketCap",
        publisher: "CoinMarketCap",
        href: "https://coinmarketcap.com/",
        covers: "Prices, market capitalization, trading volume and supply for listed coins.",
        onVirello: "The source of every price and market figure on the site.",
      },
      {
        name: "CoinMarketCap methodology",
        publisher: "CoinMarketCap",
        href: "https://coinmarketcap.com/methodology/",
        covers: "How CoinMarketCap calculates its figures, including its indexes.",
        onVirello: "Read it to see how the Fear and Greed score and market totals are built.",
      },
    ],
  },
];

export interface FilingType {
  form: string;
  meaning: string;
}

/** Forms a reader meets on EDGAR, in plain words. */
export const FILING_TYPES: readonly FilingType[] = [
  {
    form: "8-K",
    meaning:
      "A current report. A company files one soon after an important event, such as an acquisition, a change of leadership or a results announcement.",
  },
  {
    form: "10-K",
    meaning: "The annual report, with the company's audited financial statements.",
  },
  {
    form: "10-Q",
    meaning: "The quarterly report. Its financial statements are not audited.",
  },
  {
    form: "S-1",
    meaning:
      "A registration statement, filed before a company offers its shares to the public for the first time.",
  },
];

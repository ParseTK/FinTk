import { Container } from "@/components/ui/Container";
import { isEnabled } from "@/lib/flags";
import { AboutSources, AboutSteps, type AboutSourcePanel, type AboutStep } from "./AboutExplorer";

/** What each step says depends on which pages are switched on: a page that is off is not described. */
function steps(): AboutStep[] {
  const markets = isEnabled("crypto_markets");
  const news = isEnabled("crypto_news");
  return [
    {
      title: "See the wider market.",
      body: "Start with market size, trading activity and the Fear & Greed indicator to set the broader context.",
      tags: ["Market size", "Volume", "Sentiment"],
    },
    {
      title: "Look closer at a coin.",
      body: markets
        ? "See the largest coins and how each has changed over 24 hours, 7, 30 and 90 days, and the year so far."
        : "Find a coin and read its figures as reported, with nothing drawn in between.",
      tags: markets
        ? ["24h", "7d", "30d", "90d", "Year to date"]
        : ["Price", "Market cap", "Supply"],
    },
    {
      title: "Go back to the source.",
      body: news
        ? "Read official announcements and company filings that mention crypto, newest first, exactly as published."
        : "Every figure comes from a named source, and a figure we cannot get is shown as missing, never made up.",
      tags: news ? ["SEC", "CFTC", "Justice Dept.", "Form 8-K"] : ["Named sources", "No guesses"],
    },
  ];
}

function sources(): AboutSourcePanel[] {
  return [
    {
      tab: "Market figures",
      eyebrow: "Prices & market data",
      name: "CoinMarketCap.com",
      href: "https://coinmarketcap.com/",
      caption: "Prices, market size and trading activity.",
      detail:
        "Figures are shown as reported. Prices refresh about every ten minutes, and missing values stay visibly missing.",
      facts: [
        { label: "Refresh", value: "~10 min" },
        { label: "Quotes", value: "Not live" },
      ],
    },
    {
      tab: "Official sources",
      eyebrow: "Announcements & filings",
      name: "SEC, CFTC, Justice Dept.",
      caption: "Public announcements and company filings.",
      detail:
        "Press releases from US agencies, and Form 8-K filings of listed crypto companies, kept only when they mention crypto. Nothing is ranked or commented on.",
      facts: [
        { label: "Order", value: "Newest first" },
        { label: "Opinions", value: "None" },
      ],
    },
    {
      tab: "Coverage & limits",
      eyebrow: "What to keep in mind",
      name: "A research aid, not a quote feed.",
      caption: "Free, and for personal, non-commercial use.",
      detail:
        "Only the largest coins are covered and there is no full price history, only the change over each period. This is information, not investment advice. It can be slow or briefly unavailable.",
      facts: [
        { label: "Coverage", value: "Largest coins" },
        { label: "History", value: "Period changes" },
      ],
    },
  ];
}

/**
 * The landing page's plain explanation: what the site is, a three-step way to use it, and where the
 * data comes from with its limits. Static copy written to match what the site really does today.
 */
export function AboutSection() {
  return (
    <section aria-labelledby="about-heading" className="border-border border-t">
      <Container size="wide" className="space-y-10 py-14 lg:py-20">
        <div className="text-fg-muted border-border flex flex-wrap items-center justify-between gap-2 border-b pb-3 text-xs tracking-[0.14em] uppercase">
          <p className="text-brand font-semibold">About FinTk</p>
          <p>Free to explore / Built for personal research</p>
        </div>

        <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <div className="space-y-6">
            <h2
              id="about-heading"
              className="text-2xl leading-[1.1] font-bold tracking-tight sm:text-3xl lg:text-4xl"
            >
              Market context. <br />
              Original sources. <br />
              <span className="text-brand font-medium italic">A clearer starting point.</span>
            </h2>
            <p className="text-fg-muted max-w-md text-lg">
              FinTk brings crypto market figures, public announcements and company filings into one
              place, so you can spend more time understanding what you find.
            </p>
            <p className="text-fg-muted text-sm">
              <span aria-hidden="true">&bull; </span>Published information. A source you can trace.
            </p>
          </div>
          <AboutSteps steps={steps()} />
        </div>

        <AboutSources title="A clear view of where it comes from." panels={sources()} />
      </Container>
    </section>
  );
}

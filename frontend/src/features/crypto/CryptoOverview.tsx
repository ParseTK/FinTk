import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { DataCredit } from "@/components/ui/DataCredit";
import { Feature } from "@/components/ui/Feature";
import { updatedLabel } from "./crypto";
import { getCryptoOverview } from "./data";
import { MarketMood } from "./MarketMood";

// min-h-6: a link on its own line is at least 24 CSS pixels tall (WCAG 2.2, target size).
const LINK = "text-brand inline-flex min-h-6 items-center font-medium underline underline-offset-2";

/** What this section offers and what it cannot do. Static: it does not depend on the figures. */
function About() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card as="section" aria-labelledby="whats-here-heading" className="space-y-3 rounded-2xl">
        <h2 id="whats-here-heading" className="text-xl font-semibold">
          What you can find here
        </h2>
        <ul className="text-fg-muted list-disc space-y-2 pl-5">
          <Feature flag="crypto_markets">
            <li>
              <Link href="/crypto/markets" className={LINK}>
                Markets
              </Link>
              : the whole market&apos;s size and volume, Bitcoin&apos;s price, the day&apos;s
              largest gain and decline, and the largest coins with how they have done over time.
            </li>
          </Feature>
          <Feature flag="crypto_news">
            <li>
              <Link href="/crypto/news" className={LINK}>
                News
              </Link>
              : announcements and filings from official US sources that mention crypto, newest
              first.
            </li>
          </Feature>
          <li>The mood of the market, above: its total value and the Fear and Greed index.</li>
        </ul>
      </Card>
      <Card as="section" aria-labelledby="limits-heading" className="space-y-3 rounded-2xl">
        <h2 id="limits-heading" className="text-xl font-semibold">
          What to keep in mind
        </h2>
        <ul className="text-fg-muted list-disc space-y-2 pl-5">
          <li>Prices refresh about every ten minutes, so they are not live quotes.</li>
          <li>Only the largest coins are covered, not every coin that exists.</li>
          <li>
            There is no full price history. Coins show their reported change over fixed periods (24
            hours up to a year), nothing in between.
          </li>
          <li>The news comes only from official sources, so some days there is little or none.</li>
          <li>For personal, non-commercial use. This is information, not investment advice.</li>
        </ul>
      </Card>
    </div>
  );
}

/**
 * The crypto overview: the market's mood, then what the section offers and its limits. A server
 * component. The figures come from our API (which holds the provider's key and a short cache); the
 * provider's credit line comes with them and sits above them, because the licence requires it next
 * to the data. If the figures cannot be had the page still explains itself and says so plainly.
 */
export async function CryptoOverview() {
  const data = await getCryptoOverview();
  const updated = data ? updatedLabel(data.as_of) : null;
  const hasMood = data !== null && (data.totals !== null || data.fear_greed !== null);

  return (
    <div className="space-y-8">
      {data === null ? (
        <Alert title="Crypto figures are not available right now">
          The market mood could not be loaded. Please try again in a moment.
        </Alert>
      ) : (
        <>
          <div className="space-y-2">
            <DataCredit
              text={data.attribution.text}
              href={data.attribution.url}
              linkText="CoinMarketCap.com"
            />
            <p className="text-fg-muted text-sm">
              Prices in US dollars{updated ? `, updated ${updated}` : ""}. They refresh about every
              ten minutes.
            </p>
          </div>
          {data.unavailable.length > 0 && (
            <Alert title="Some figures are unavailable">
              Could not load: {data.unavailable.join(" and ")}. The rest is shown below.
            </Alert>
          )}
          {hasMood && (
            <section aria-labelledby="mood-heading" className="space-y-3">
              <h2 id="mood-heading" className="text-xl font-semibold">
                Market mood
              </h2>
              <MarketMood totals={data.totals} fearGreed={data.fear_greed} />
            </section>
          )}
        </>
      )}
      <About />
    </div>
  );
}

import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Feature } from "@/components/ui/Feature";

const LINK = "text-brand font-medium underline underline-offset-2";

function Block({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <Card as="section" aria-labelledby={id} className="space-y-3 rounded-2xl">
      <h3 id={id} className="text-xl font-semibold">
        {title}
      </h3>
      {children}
    </Card>
  );
}

/**
 * The landing page's plain explanation: what the site is, what it does, where the data comes from
 * and what its limits are. Static copy, written to match what the site really does today; a page
 * that is switched off is not described as available.
 */
export function AboutSection() {
  return (
    <section aria-labelledby="about-heading" className="border-border border-t">
      <Container className="space-y-8 py-14 lg:py-20">
        <div className="max-w-2xl space-y-3">
          <h2 id="about-heading" className="text-3xl font-bold tracking-tight">
            About Virello
          </h2>
          <p className="text-fg-muted text-lg">
            Virello is a free research site for crypto. It puts market figures and official
            announcements in one place, shown as published: no opinions, rankings or predictions.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Block id="about-does" title="What it does">
            <ul className="text-fg-muted list-disc space-y-2 pl-5">
              <li>Shows the mood of the whole market: its size, volume and Fear and Greed.</li>
              <Feature flag="crypto_markets">
                <li>
                  Lists the largest coins and how each has changed over 24 hours, 7, 30 and 90 days,
                  the year so far and the past year.
                </li>
              </Feature>
              <Feature flag="crypto_news">
                <li>
                  Collects official announcements and company filings that mention crypto, newest
                  first.
                </li>
              </Feature>
            </ul>
          </Block>

          <Block id="about-data" title="Where the data comes from">
            <ul className="text-fg-muted list-disc space-y-2 pl-5">
              <li>
                Prices and market figures: Data provided by{" "}
                <a href="https://coinmarketcap.com/" rel="noopener noreferrer" className={LINK}>
                  CoinMarketCap.com
                </a>
                .
              </li>
              <li>
                News: public announcements from the US SEC, CFTC and Department of Justice, and SEC
                filings (Form 8-K) of listed crypto companies.
              </li>
              <li>
                Nothing else, and nothing is made up. A figure we cannot get is shown as missing.
              </li>
            </ul>
          </Block>

          <Block id="about-limits" title="Limits">
            <ul className="text-fg-muted list-disc space-y-2 pl-5">
              <li>Prices refresh about every ten minutes, so they are not live quotes.</li>
              <li>Only the largest coins are covered, not every coin that exists.</li>
              <li>
                There is no full price history: only the change over each period, with nothing drawn
                in between.
              </li>
              <li>The news is official sources only, so some days there is little or none.</li>
            </ul>
          </Block>

          <Block id="about-use" title="How to use it">
            <ul className="text-fg-muted list-disc space-y-2 pl-5">
              <li>For personal, non-commercial use, for research and education.</li>
              <li>This is information, not investment advice.</li>
              <li>It is a free project, so it can be slow or briefly unavailable.</li>
            </ul>
          </Block>
        </div>
      </Container>
    </section>
  );
}

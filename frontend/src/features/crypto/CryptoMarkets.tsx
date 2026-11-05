import type { ReactNode } from "react";
import { isEnabled } from "@/lib/flags";
import { Alert } from "@/components/ui/Alert";
import { DataCredit } from "@/components/ui/DataCredit";
import { ErrorState } from "@/components/ui/ErrorState";
import { BitcoinChanges } from "./CoinChanges";
import { CompositionPanel } from "./CompositionPanel";
import { updatedLabel } from "./crypto";
import { CryptoTable } from "./CryptoTable";
import { getCryptoMarkets, getCryptoOverview } from "./data";
import { InFocus } from "./InFocus";
import { MajorsTable } from "./MajorsTable";
import { StatTiles } from "./StatTiles";
import type { CryptoMarkets as MarketsData, CryptoOverview } from "./types";

type Overview = CryptoOverview | null;
type Markets = MarketsData | null;

/** Everything the page could not load, named, so it never looks more complete than it is. */
function missingParts(overview: Overview, markets: Markets): string[] {
  const unavailable = [
    ...new Set([...(overview?.unavailable ?? []), ...(markets?.unavailable ?? [])]),
  ];
  return [
    ...(overview === null ? ["the largest coins and market totals"] : []),
    ...(markets === null ? ["Bitcoin's price and the market make-up"] : []),
    ...unavailable,
  ];
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-heading`} className="space-y-3">
      <h2 id={`${id}-heading`} className="text-xl font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** The provider's credit and the standing notes. The licence requires the credit by the data. */
function Header({ overview, markets }: { overview: Overview; markets: Markets }) {
  const source = markets ?? overview!;
  const updated = updatedLabel(source.as_of);
  return (
    <div className="space-y-2">
      <DataCredit
        text={source.attribution.text}
        href={source.attribution.url}
        linkText="CoinMarketCap.com"
      />
      <p className="text-fg-muted text-sm">
        Prices in US dollars{updated ? `, updated ${updated}` : ""}. For personal, non-commercial
        use. This is information, not investment advice.
      </p>
    </div>
  );
}

/** Bitcoin's reported changes beside the day's biggest movers, when there is something to show. */
function Highlights({ overview, markets }: { overview: Overview; markets: Markets }) {
  const chart = BitcoinChanges({ markets, credit: false });
  const movers = overview !== null && overview.assets.length > 1;
  if (!chart && !movers) return null;
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      {chart}
      {overview && <InFocus assets={overview.assets} />}
    </div>
  );
}

function LargestCoins({ overview, linkCoins }: { overview: Overview; linkCoins: boolean }) {
  if (!overview || overview.assets.length === 0) return null;
  return (
    <Section id="coins" title="Largest coins by market cap">
      <CryptoTable
        caption="Largest coins by market capitalization"
        assets={overview.assets}
        linkCoins={linkCoins}
      />
    </Section>
  );
}

function MarketMakeup({ markets }: { markets: Markets }) {
  if (!markets?.composition) return null;
  return (
    <Section id="makeup" title="Market make-up">
      <CompositionPanel composition={markets.composition} />
    </Section>
  );
}

function TenLargest({ markets, linkCoins }: { markets: Markets; linkCoins: boolean }) {
  if (!markets || markets.majors.length === 0) return null;
  return (
    <Section id="majors" title="The ten largest coins over time">
      <p className="text-fg-muted text-sm">
        Each change is measured from the price on the day shown. Year to date and past year are
        worked out from two prices, so they are exact for those days.
      </p>
      <MajorsTable
        coins={markets.majors}
        yearStart={markets.year_start}
        pastYearStart={markets.past_year_start}
        caption="How the ten largest coins have done"
        linkCoins={linkCoins}
      />
    </Section>
  );
}

/**
 * The crypto markets page body: headline figures, Bitcoin's price, the day's biggest movers, the
 * largest coins, then how the market is made up and how the ten largest have done over time. A
 * server component fed by two responses (overview and markets); either may be missing, and the page
 * then shows what it has and names what it lacks. Each part of the page is its own small component
 * that hides itself when its data is absent.
 */
export async function CryptoMarkets() {
  const [overview, markets] = await Promise.all([getCryptoOverview(), getCryptoMarkets()]);

  if (overview === null && markets === null) {
    return (
      <ErrorState
        title="Crypto markets are not available right now"
        description="Please try again in a moment."
      />
    );
  }

  const missing = missingParts(overview, markets);
  const linkCoins = isEnabled("crypto_search");

  return (
    <div className="space-y-8">
      <Header overview={overview} markets={markets} />
      {missing.length > 0 && (
        <Alert title="Some figures are unavailable">
          Could not load: {missing.join(", ")}. The rest is shown below.
        </Alert>
      )}
      <StatTiles totals={overview?.totals ?? null} composition={markets?.composition ?? null} />
      <Highlights overview={overview} markets={markets} />
      <LargestCoins overview={overview} linkCoins={linkCoins} />
      <MarketMakeup markets={markets} />
      <TenLargest markets={markets} linkCoins={linkCoins} />
    </div>
  );
}

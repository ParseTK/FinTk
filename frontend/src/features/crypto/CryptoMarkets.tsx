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

/**
 * The crypto markets page body: headline figures, Bitcoin's price, the day's biggest movers, the
 * largest coins, then how the market is made up and how the ten largest have done over time. A
 * server component fed by two responses (overview and markets); either may be missing, and the page
 * then shows what it has and names what it lacks, so it never looks more complete than it is. The
 * provider's credit line sits above the data, because the licence requires it next to the data.
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

  const source = markets ?? overview!;
  const updated = updatedLabel(source.as_of);
  const unavailable = [
    ...new Set([...(overview?.unavailable ?? []), ...(markets?.unavailable ?? [])]),
  ];
  const missing = [
    ...(overview === null ? ["the largest coins and market totals"] : []),
    ...(markets === null ? ["Bitcoin's price and the market make-up"] : []),
    ...unavailable,
  ];
  const linkCoins = isEnabled("crypto_search");
  const chart = BitcoinChanges({ markets, credit: false });

  return (
    <div className="space-y-8">
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

      {missing.length > 0 && (
        <Alert title="Some figures are unavailable">
          Could not load: {missing.join(", ")}. The rest is shown below.
        </Alert>
      )}

      <StatTiles totals={overview?.totals ?? null} composition={markets?.composition ?? null} />

      {(chart || (overview && overview.assets.length > 1)) && (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {chart}
          {overview && <InFocus assets={overview.assets} />}
        </div>
      )}

      {overview && overview.assets.length > 0 && (
        <section aria-labelledby="coins-heading" className="space-y-3">
          <h2 id="coins-heading" className="text-xl font-semibold">
            Largest coins by market cap
          </h2>
          <CryptoTable
            caption="Largest coins by market capitalization"
            assets={overview.assets}
            linkCoins={linkCoins}
          />
        </section>
      )}

      {markets?.composition && (
        <section aria-labelledby="makeup-heading" className="space-y-3">
          <h2 id="makeup-heading" className="text-xl font-semibold">
            Market make-up
          </h2>
          <CompositionPanel composition={markets.composition} />
        </section>
      )}

      {markets && markets.majors.length > 0 && (
        <section aria-labelledby="majors-heading" className="space-y-3">
          <h2 id="majors-heading" className="text-xl font-semibold">
            The ten largest coins over time
          </h2>
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
        </section>
      )}
    </div>
  );
}

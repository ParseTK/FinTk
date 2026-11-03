import { Alert } from "@/components/ui/Alert";
import { DataCredit } from "@/components/ui/DataCredit";
import { ErrorState } from "@/components/ui/ErrorState";
import { updatedLabel } from "./crypto";
import { CryptoTable } from "./CryptoTable";
import { getCryptoOverview } from "./data";
import { MarketMood } from "./MarketMood";

/**
 * The crypto page body. A server component: the figures come from our API (which holds the
 * provider's key and a short cache) and the page only shows them. The provider's credit line comes
 * with the data and sits above it, because the licence requires it next to the data.
 */
export async function CryptoOverview() {
  const data = await getCryptoOverview();

  if (data === null) {
    return (
      <ErrorState
        title="Crypto prices are not available right now"
        description="Please try again in a moment."
      />
    );
  }

  const updated = updatedLabel(data.as_of);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <DataCredit
          text={data.attribution.text}
          href={data.attribution.url}
          linkText="CoinMarketCap.com"
        />
        <p className="text-fg-muted text-sm">
          Prices in US dollars{updated ? `, updated ${updated}` : ""}. They refresh about every ten
          minutes. For personal, non-commercial use. This is information, not investment advice.
        </p>
      </div>

      {data.unavailable.length > 0 && (
        <Alert title="Some figures are unavailable">
          Could not load: {data.unavailable.join(" and ")}. The rest is shown below.
        </Alert>
      )}

      {(data.totals || data.fear_greed) && (
        <section aria-labelledby="mood-heading" className="space-y-3">
          <h2 id="mood-heading" className="text-xl font-semibold">
            Market mood
          </h2>
          <MarketMood totals={data.totals} fearGreed={data.fear_greed} />
        </section>
      )}

      <section aria-labelledby="coins-heading" className="space-y-3">
        <h2 id="coins-heading" className="text-xl font-semibold">
          Largest coins by market cap
        </h2>
        <CryptoTable caption="Largest coins by market capitalization" assets={data.assets} />
      </section>
    </div>
  );
}

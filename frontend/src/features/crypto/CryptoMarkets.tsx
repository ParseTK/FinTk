import { Alert } from "@/components/ui/Alert";
import { DataCredit } from "@/components/ui/DataCredit";
import { ErrorState } from "@/components/ui/ErrorState";
import { CompositionPanel } from "./CompositionPanel";
import { updatedLabel } from "./crypto";
import { getCryptoMarkets } from "./data";
import { MajorsTable } from "./MajorsTable";

/**
 * The crypto markets page body: how the market is made up, then how the largest coins have done. A
 * server component. The provider's credit line comes with the data and sits above it, because the
 * licence requires it next to the data. A part that could not be loaded is named, so the page never
 * looks more complete than it is.
 */
export async function CryptoMarkets() {
  const data = await getCryptoMarkets();

  if (data === null) {
    return (
      <ErrorState
        title="Crypto markets are not available right now"
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
          Prices in US dollars{updated ? `, updated ${updated}` : ""}. For personal, non-commercial
          use. This is information, not investment advice.
        </p>
      </div>

      {data.unavailable.length > 0 && (
        <Alert title="Some figures are unavailable">
          Could not load: {data.unavailable.join(", ")}. The rest is shown below.
        </Alert>
      )}

      {data.composition && (
        <section aria-labelledby="makeup-heading" className="space-y-3">
          <h2 id="makeup-heading" className="text-xl font-semibold">
            Market make-up
          </h2>
          <CompositionPanel composition={data.composition} />
        </section>
      )}

      <section aria-labelledby="majors-heading" className="space-y-3">
        <h2 id="majors-heading" className="text-xl font-semibold">
          The ten largest coins over time
        </h2>
        <p className="text-fg-muted text-sm">
          Each change is measured from the price on the day shown. Year to date and past year are
          worked out from two prices, so they are exact for those days.
        </p>
        <MajorsTable
          coins={data.majors}
          yearStart={data.year_start}
          pastYearStart={data.past_year_start}
          caption="How the ten largest coins have done"
        />
      </section>
    </div>
  );
}

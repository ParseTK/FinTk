import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { getMarketOverview } from "./data";
import { asOfLabel } from "./markets";
import { MarketTable } from "./MarketTable";
import { SectorBars } from "./SectorBars";

/**
 * The market page body: indices, then sectors. A server component that waits for the figures
 * itself (the first visit can be slow while history is stored), so the heading can be shown first.
 */
export async function MarketsOverview() {
  const data = await getMarketOverview();

  if (data === null) {
    return (
      <ErrorState
        title="Market figures are not available right now"
        description="Please try again in a moment."
      />
    );
  }

  const indices = data.rows.filter((row) => row.group === "index");
  const sectors = data.rows.filter((row) => row.group === "sector");
  const loaded = data.rows.filter((row) => row.figures !== null);
  const missing = data.rows.length - loaded.length;
  const asOf = loaded.map(asOfLabel).filter((label): label is string => label !== null)[0];

  return (
    <div className="space-y-8">
      {data.source === "sample" && (
        <Alert title="Sample data">
          These figures are generated to demonstrate the page. They are not real market results.
        </Alert>
      )}
      {missing > 0 && (
        <Alert title="Still loading some history">
          {missing} of {data.rows.length} funds have no figures yet. Price history is fetched once
          and then kept, so they fill in over the next few minutes. Reload to see them.
        </Alert>
      )}

      <p className="text-fg-muted text-sm">
        {data.basis} Based on month-end closes{asOf ? `, latest ${asOf}` : ""}, so the figures can
        trail the market by up to a month. Each line is an ETF that tracks the index or sector, not
        the index itself.
      </p>

      <section aria-labelledby="indices-heading" className="space-y-3">
        <h2 id="indices-heading" className="text-xl font-semibold">
          Major indices
        </h2>
        <MarketTable caption="Major indices" rows={indices} />
      </section>

      <section aria-labelledby="sectors-heading" className="space-y-3">
        <h2 id="sectors-heading" className="text-xl font-semibold">
          Sectors
        </h2>
        <Card className="space-y-3 rounded-2xl">
          <h3 className="text-sm font-semibold">Year to date, best to worst</h3>
          <SectorBars rows={sectors} />
        </Card>
        <MarketTable caption="Sectors" rows={sectors} />
      </section>
    </div>
  );
}

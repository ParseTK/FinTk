import { Card } from "@/components/ui/Card";
import { formatPercent } from "@/lib/format";
import { compactUsd } from "./crypto";
import type { FearGreed, MarketTotals } from "./types";

const NOT_AVAILABLE = <span className="text-fg-muted text-base font-normal">Not available</span>;

/**
 * The Fear and Greed index as a number with the provider's own label and a bar. The bar is a
 * picture of the number; the number and the label carry the meaning, so nothing depends on seeing it.
 */
function FearGreedCard({ index }: { index: FearGreed }) {
  const value = Math.min(100, Math.max(0, index.value));
  return (
    <Card as="section" aria-labelledby="fear-greed-heading" className="space-y-3 rounded-2xl">
      <h3 id="fear-greed-heading" className="text-fg-muted text-sm font-medium">
        Fear and Greed index
      </h3>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-4xl font-bold tabular-nums">{value}</span>
        <span className="text-fg-muted">out of 100</span>
        <span className="font-semibold">{index.label}</span>
      </p>
      <div aria-hidden="true" className="bg-border relative h-2 rounded-full">
        <span
          className="bg-brand border-surface absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
          style={{ left: `${value}%` }}
        />
      </div>
      <p className="text-fg-muted text-sm">0 is extreme fear and 100 is extreme greed.</p>
    </Card>
  );
}

function TotalsCard({ totals }: { totals: MarketTotals }) {
  const rows: ReadonlyArray<readonly [label: string, value: string | null]> = [
    ["Total market cap", compactUsd(totals.total_market_cap)],
    ["Volume (24 hours)", compactUsd(totals.total_volume_24h)],
    [
      "Bitcoin share",
      totals.btc_dominance === null ? null : formatPercent(totals.btc_dominance, { digits: 1 }),
    ],
    [
      "Ethereum share",
      totals.eth_dominance === null ? null : formatPercent(totals.eth_dominance, { digits: 1 }),
    ],
  ];
  return (
    <Card as="section" aria-labelledby="totals-heading" className="space-y-3 rounded-2xl">
      <h3 id="totals-heading" className="text-fg-muted text-sm font-medium">
        The whole market
      </h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-fg-muted text-sm">{label}</dt>
            <dd className="mt-0.5 text-xl font-semibold tabular-nums">{value ?? NOT_AVAILABLE}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

/** The two summary cards. Either may be missing; the page says which, so it never looks complete. */
export function MarketMood({
  totals,
  fearGreed,
}: {
  totals: MarketTotals | null;
  fearGreed: FearGreed | null;
}) {
  if (!totals && !fearGreed) return null;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {totals && <TotalsCard totals={totals} />}
      {fearGreed && <FearGreedCard index={fearGreed} />}
    </div>
  );
}

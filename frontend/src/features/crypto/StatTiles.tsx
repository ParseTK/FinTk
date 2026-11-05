import { Card } from "@/components/ui/Card";
import { Change } from "@/components/ui/Change";
import { formatPercent } from "@/lib/format";
import { compactUsd } from "./crypto";
import type { Composition, MarketTotals } from "./types";

const NOT_AVAILABLE = <span className="text-fg-muted text-base font-normal">Not available</span>;

/**
 * Three headline figures: the whole market's value, its 24 hour trading volume, and Bitcoin's
 * share of it. Each comes from whichever response has it; a missing one says so. Returns null when
 * none of them can be had.
 */
export function StatTiles({
  totals,
  composition,
}: {
  totals: MarketTotals | null;
  composition: Composition | null;
}) {
  const marketCap = compactUsd(totals?.total_market_cap ?? composition?.total_market_cap);
  const volume = compactUsd(totals?.total_volume_24h);
  const bitcoinShare =
    totals?.btc_dominance ?? composition?.rows.find((row) => row.key === "bitcoin")?.share ?? null;
  if (marketCap === null && volume === null && bitcoinShare === null) return null;

  return (
    <dl className="grid gap-4 sm:grid-cols-3">
      <Card className="rounded-2xl">
        <dt className="text-fg-muted text-xs font-semibold tracking-wide uppercase">
          Total market cap
        </dt>
        <dd className="mt-2 text-2xl font-bold tabular-nums">{marketCap ?? NOT_AVAILABLE}</dd>
        {composition?.total_change_24h != null && (
          <dd className="mt-1 text-sm">
            <Change value={composition.total_change_24h} />
            <span className="text-fg-muted"> over 24 hours</span>
          </dd>
        )}
      </Card>
      <Card className="rounded-2xl">
        <dt className="text-fg-muted text-xs font-semibold tracking-wide uppercase">
          24 hour trading volume
        </dt>
        <dd className="mt-2 text-2xl font-bold tabular-nums">{volume ?? NOT_AVAILABLE}</dd>
        <dd className="text-fg-muted mt-1 text-sm">Across the market</dd>
      </Card>
      <Card className="rounded-2xl">
        <dt className="text-fg-muted text-xs font-semibold tracking-wide uppercase">
          Bitcoin share
        </dt>
        <dd className="mt-2 text-2xl font-bold tabular-nums">
          {bitcoinShare === null ? NOT_AVAILABLE : formatPercent(bitcoinShare, { digits: 1 })}
        </dd>
        <dd className="text-fg-muted mt-1 text-sm">Of total market value</dd>
      </Card>
    </dl>
  );
}

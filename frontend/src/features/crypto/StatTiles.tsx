import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { Change } from "@/components/ui/Change";
import { formatPercent } from "@/lib/format";
import { compactUsd } from "./crypto";
import type { Composition, MarketTotals } from "./types";

const NOT_AVAILABLE = <span className="text-fg-muted text-base font-normal">Not available</span>;

/** The three figures, each from whichever response has it (null when neither does). */
function headlineFigures(totals: MarketTotals | null, composition: Composition | null) {
  return {
    marketCap: compactUsd(totals?.total_market_cap ?? composition?.total_market_cap),
    volume: compactUsd(totals?.total_volume_24h),
    bitcoinShare:
      totals?.btc_dominance ??
      composition?.rows.find((row) => row.key === "bitcoin")?.share ??
      null,
  };
}

/** One tile: a label, the figure (or "Not available") and a line of context under it. */
function Tile({
  label,
  value,
  children,
}: {
  label: string;
  value: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="rounded-2xl">
      <dt className="text-fg-muted text-xs font-semibold tracking-wide uppercase">{label}</dt>
      <dd className="mt-2 text-2xl font-bold tabular-nums">{value ?? NOT_AVAILABLE}</dd>
      {children}
    </Card>
  );
}

const Note = ({ children }: { children: ReactNode }) => (
  <dd className="text-fg-muted mt-1 text-sm">{children}</dd>
);

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
  const { marketCap, volume, bitcoinShare } = headlineFigures(totals, composition);
  if (marketCap === null && volume === null && bitcoinShare === null) return null;
  const change = composition?.total_change_24h;

  return (
    <dl className="grid gap-4 sm:grid-cols-3">
      <Tile label="Total market cap" value={marketCap}>
        {change != null && (
          <dd className="mt-1 text-sm">
            <Change value={change} />
            <span className="text-fg-muted"> over 24 hours</span>
          </dd>
        )}
      </Tile>
      <Tile label="24 hour trading volume" value={volume}>
        <Note>Across the market</Note>
      </Tile>
      <Tile
        label="Bitcoin share"
        value={bitcoinShare === null ? null : formatPercent(bitcoinShare, { digits: 1 })}
      >
        <Note>Of total market value</Note>
      </Tile>
    </dl>
  );
}

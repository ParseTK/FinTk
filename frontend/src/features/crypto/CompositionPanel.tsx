import clsx from "clsx";
import { Card } from "@/components/ui/Card";
import { Change } from "@/components/ui/Change";
import { formatNumber, formatPercent, isNegative, isPositive } from "@/lib/format";
import { compactUsd } from "./crypto";
import type { Composition, CompositionRow } from "./types";

const NOT_AVAILABLE = <span className="text-fg-muted whitespace-nowrap">Not available</span>;

/** Colours for the picture of the three slices. The names and numbers beside them carry the meaning. */
const SWATCH: Record<string, string> = {
  bitcoin: "bg-brand",
  ethereum: "bg-fg-muted",
  other: "bg-border-strong",
};

/** A change in a share, in percentage points: signed, never coloured (it is not a gain or a loss). */
function Points({ value }: { value: string | null }) {
  if (value === null) return NOT_AVAILABLE;
  const sign = isPositive(value) ? "+" : isNegative(value) ? "-" : "";
  const text = formatNumber(String(Math.abs(Number(value))), 2);
  return (
    <span className="whitespace-nowrap tabular-nums">
      {sign}
      {text}
      <span aria-hidden="true"> pts</span>
      <span className="sr-only"> percentage points</span>
    </span>
  );
}

const Share = ({ value }: { value: string | null }) =>
  value === null ? (
    NOT_AVAILABLE
  ) : (
    <span className="tabular-nums">{formatPercent(value, { digits: 1 })}</span>
  );

const Money = ({ value }: { value: string | null }) => {
  const text = compactUsd(value);
  return text === null ? NOT_AVAILABLE : <span className="tabular-nums">{text}</span>;
};

function Table({
  caption,
  rows,
  withChange,
}: {
  caption: string;
  rows: readonly CompositionRow[];
  withChange: boolean;
}) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-border border-b">
            <th scope="col" className="py-2 pr-4 font-semibold">
              <span className="sr-only">Group</span>
            </th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">
              Share
            </th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">
              Market cap
            </th>
            {withChange && (
              <th scope="col" className="px-2 py-2 text-right font-semibold">
                Since yesterday
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-border border-b last:border-0">
              <th scope="row" className="py-2 pr-4 text-left font-normal">
                {SWATCH[row.key] && (
                  <span
                    aria-hidden="true"
                    className={clsx(
                      "mr-2 inline-block size-3 rounded-sm align-middle",
                      SWATCH[row.key],
                    )}
                  />
                )}
                {row.label}
              </th>
              <td className="px-2 py-2 text-right">
                <Share value={row.share} />
              </td>
              <td className="px-2 py-2 text-right">
                <Money value={row.market_cap} />
              </td>
              {withChange && (
                <td className="px-2 py-2 text-right">
                  <Points value={row.share_change} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * How the market is made up: Bitcoin, Ethereum and everything else as shares of the whole (a bar and
 * a table), then stablecoins and DeFi tokens as groups that overlap those slices. The bar is only a
 * picture of the table, so nothing depends on seeing it.
 */
export function CompositionPanel({ composition }: { composition: Composition }) {
  const slices = composition.rows.filter((row) => !row.overlaps);
  const groups = composition.rows.filter((row) => row.overlaps);
  const total = compactUsd(composition.total_market_cap);

  return (
    <Card className="space-y-5 rounded-2xl">
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-fg-muted text-sm">Total market cap</span>
        <span className="text-3xl font-bold tabular-nums">{total ?? "Not available"}</span>
        {composition.total_change_24h !== null && (
          <span className="text-sm">
            <Change value={composition.total_change_24h} />
            <span className="text-fg-muted"> in 24 hours</span>
          </span>
        )}
      </p>

      <div aria-hidden="true" className="bg-border flex h-3 w-full overflow-clip rounded-full">
        {slices.map((row) =>
          row.share === null ? null : (
            <span
              key={row.key}
              className={SWATCH[row.key]}
              style={{ width: `${Math.max(0, Math.min(100, Number(row.share)))}%` }}
            />
          ),
        )}
      </div>

      <Table caption="Share of the total market capitalization" rows={slices} withChange />

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Groups inside those slices</h3>
        <p className="text-fg-muted text-sm">
          Stablecoins and DeFi tokens are also counted among the coins above, so these rows overlap
          the table above and each other. Do not add them up.
        </p>
        <Table caption="Groups that overlap the slices above" rows={groups} withChange={false} />
      </div>
    </Card>
  );
}

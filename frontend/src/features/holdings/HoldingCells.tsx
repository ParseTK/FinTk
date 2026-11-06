import Link from "next/link";
import { Change } from "@/components/ui/Change";
import { formatMoney } from "@/lib/format";
import type { HoldingValue } from "./data";

/** The small pieces a holding's table row and its phone card both show, so they cannot disagree. */

export const NOT_PRICED = <span className="text-fg-muted">Not priced</span>;

export const money = (value: string | null) =>
  value === null ? NOT_PRICED : <span className="tabular-nums">{formatMoney(value)}</span>;

export function Gain({ row }: { row: HoldingValue }) {
  if (row.gain === null) {
    return (
      <span className="text-fg-muted">{row.cost === null ? "No cost entered" : "Not priced"}</span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-baseline justify-end gap-x-2">
      <Change kind="money" value={row.gain} />
      {row.gain_percent !== null && <Change value={row.gain_percent} />}
    </span>
  );
}

export function CoinLink({ row, withSymbol = false }: { row: HoldingValue; withSymbol?: boolean }) {
  const label = row.coin ? row.coin.name : row.slug;
  return (
    <>
      <Link
        href={`/crypto/coins/${row.slug}`}
        className="font-medium underline-offset-2 hover:underline"
      >
        {label}
      </Link>
      {withSymbol && row.coin && (
        <>
          {" "}
          <span className="text-fg-muted text-sm">{row.coin.symbol}</span>
        </>
      )}
    </>
  );
}

/** What the inline editor needs to know about a row. */
export const editing = (row: HoldingValue, csrfToken: string) => ({
  slug: row.slug,
  name: row.coin?.name ?? row.slug,
  symbol: row.coin?.symbol ?? row.slug,
  amount: row.amount,
  cost: row.cost,
  csrfToken,
});

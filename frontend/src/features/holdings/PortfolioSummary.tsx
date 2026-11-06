import { Card } from "@/components/ui/Card";
import { Change } from "@/components/ui/Change";
import { formatMoney } from "@/lib/format";
import type { Portfolio } from "./data";

/** Three headline figures: total value, what was paid (where entered) and the gain or loss. */
export function PortfolioSummary({ portfolio }: { portfolio: Portfolio }) {
  const { totals, holdings } = portfolio;
  const withoutCost = holdings.filter((row) => row.cost === null && row.value !== null).length;
  return (
    <dl className="grid gap-4 sm:grid-cols-3">
      <Card className="rounded-2xl">
        <dt className="text-fg-muted text-xs font-semibold tracking-wide uppercase">Total value</dt>
        <dd className="mt-2 text-2xl font-bold tabular-nums">{formatMoney(totals.total_value)}</dd>
        <dd className="text-fg-muted mt-1 text-sm">
          {totals.priced} {totals.priced === 1 ? "coin" : "coins"} priced
          {totals.unpriced > 0 ? `, ${totals.unpriced} not priced` : ""}
        </dd>
      </Card>
      <Card className="rounded-2xl">
        <dt className="text-fg-muted text-xs font-semibold tracking-wide uppercase">
          Paid, where entered
        </dt>
        <dd className="mt-2 text-2xl font-bold tabular-nums">{formatMoney(totals.cost)}</dd>
        <dd className="text-fg-muted mt-1 text-sm">
          {withoutCost > 0
            ? `${withoutCost} ${withoutCost === 1 ? "holding has" : "holdings have"} no cost entered`
            : "Every priced holding has a cost"}
        </dd>
      </Card>
      <Card className="rounded-2xl">
        <dt className="text-fg-muted text-xs font-semibold tracking-wide uppercase">
          Gain or loss
        </dt>
        <dd className="mt-2 text-2xl font-bold">
          {totals.gain === null ? (
            <span className="text-fg-muted text-base font-normal">Enter a cost to see it</span>
          ) : (
            <Change kind="money" value={totals.gain} />
          )}
        </dd>
        <dd className="text-fg-muted mt-1 text-sm">
          {totals.gain_percent !== null && (
            <>
              <Change value={totals.gain_percent} />{" "}
            </>
          )}
          Only holdings with a cost
        </dd>
      </Card>
    </dl>
  );
}

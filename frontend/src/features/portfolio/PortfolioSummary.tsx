import { Change } from "@/components/ui/Change";
import { formatDate, formatMoney } from "@/lib/format";
import type { Portfolio } from "./types";

/**
 * What the holdings are worth, and the gain or loss against what was paid. Values come from
 * month-end closing prices, so this says plainly how recent they are and which holdings are
 * included, instead of presenting a number that looks live.
 */
export function PortfolioSummary({ portfolio }: { portfolio: Portfolio }) {
  const valuation = portfolio.valuation;
  if (!valuation) return null;
  const total = portfolio.holdings.length;
  const partial = valuation.holdings_valued < total;

  return (
    <div className="space-y-2">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-fg-muted text-sm">Paid</dt>
          <dd className="text-2xl font-semibold tabular-nums">
            {formatMoney(portfolio.total_cost_basis)}
          </dd>
        </div>
        <div>
          <dt className="text-fg-muted text-sm">Value</dt>
          <dd className="text-2xl font-semibold tabular-nums">
            {formatMoney(valuation.market_value)}
          </dd>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <dt className="text-fg-muted text-sm">Gain or loss</dt>
          <dd className="flex items-start gap-1.5 text-2xl font-semibold">
            <Change value={valuation.gain} kind="money" />
            {/* The percentage rides in the top-right corner of the amount, small, like a superscript. */}
            <span className="pt-0.5 text-xs leading-none">
              (<Change value={valuation.gain_percent} arrow={false} />)
            </span>
          </dd>
        </div>
      </dl>
      <p className="text-fg-muted text-sm">
        Based on month-end closing prices from {valuation.source}, the latest being{" "}
        {formatDate(valuation.as_of, "month-year")}, so values can trail the market by up to a
        month. Gains are price changes and do not include dividends.
        {partial &&
          ` Value and gain cover ${valuation.holdings_valued} of your ${total} holdings: the rest have no price yet.`}
      </p>
    </div>
  );
}

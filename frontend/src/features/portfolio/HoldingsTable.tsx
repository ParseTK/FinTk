import Link from "next/link";
import { Change } from "@/components/ui/Change";
import { formatMoney, formatPrice, formatShares, PLACEHOLDER } from "@/lib/format";
import type { Portfolio } from "./types";

/**
 * One row per company. With `showValue`, and when at least one holding has a price, three more
 * columns show the latest month-end price, what the holding is worth and the gain or loss. A
 * holding without a price shows dashes there rather than a guess.
 */
export function HoldingsTable({
  portfolio,
  showValue = false,
}: {
  portfolio: Portfolio;
  showValue?: boolean;
}) {
  const valued = showValue && portfolio.holdings.some((holding) => holding.valuation);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm tabular-nums">
        <caption className="sr-only">
          Your holdings, one row per company, worked out from your purchases
        </caption>
        <thead>
          <tr className="border-border border-b">
            <th scope="col" className="py-2 pr-4 font-semibold">
              Company
            </th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">
              Shares
            </th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">
              Average cost
            </th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">
              Total cost
            </th>
            {valued && (
              <>
                <th scope="col" className="px-2 py-2 text-right font-semibold">
                  Latest price
                </th>
                <th scope="col" className="px-2 py-2 text-right font-semibold">
                  Value
                </th>
                <th scope="col" className="px-2 py-2 text-right font-semibold">
                  Gain or loss
                </th>
              </>
            )}
            <th scope="col" className="py-2 pl-2 text-right font-semibold">
              Purchases
            </th>
          </tr>
        </thead>
        <tbody>
          {portfolio.holdings.map((holding) => (
            <tr key={holding.symbol} className="border-border border-b">
              <th scope="row" className="py-3 pr-4 text-base font-normal">
                <Link
                  href={`/company/${encodeURIComponent(holding.symbol)}`}
                  className="font-semibold underline-offset-2 hover:underline"
                >
                  {holding.symbol}
                </Link>
                {holding.name && (
                  <span className="text-fg-muted block text-sm">{holding.name}</span>
                )}
              </th>
              <td className="px-2 py-3 text-right">{formatShares(holding.shares)}</td>
              <td className="px-2 py-3 text-right">{formatPrice(holding.average_cost)}</td>
              <td className="px-2 py-3 text-right">{formatMoney(holding.cost_basis)}</td>
              {valued && (
                <>
                  <td className="px-2 py-3 text-right">
                    {holding.valuation ? formatPrice(holding.valuation.price) : PLACEHOLDER}
                  </td>
                  <td className="px-2 py-3 text-right">
                    {holding.valuation ? formatMoney(holding.valuation.market_value) : PLACEHOLDER}
                  </td>
                  <td className="px-2 py-3 text-right">
                    {holding.valuation ? (
                      <>
                        <Change value={holding.valuation.gain} kind="money" />
                        <span className="block text-xs">
                          <Change value={holding.valuation.gain_percent} />
                        </span>
                      </>
                    ) : (
                      PLACEHOLDER
                    )}
                  </td>
                </>
              )}
              <td className="py-3 pl-2 text-right">{holding.lots}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={3} className="py-3 pr-4 text-right font-semibold">
              Total cost of all holdings
            </th>
            <td className="px-2 py-3 text-right font-semibold">
              {formatMoney(portfolio.total_cost_basis)}
            </td>
            <td colSpan={valued ? 4 : 1} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

import { HoldingRow } from "./HoldingRow";
import type { Lot, Portfolio } from "./types";

const HEADER = "text-fg-muted px-2 py-3 text-xs font-medium tracking-wide uppercase";

/**
 * The holdings as a table whose rows open to show their own purchases, so there is no separate
 * list of purchases to scroll past. Each company wears the color of its slice in the allocation bar.
 */
export function ExpandableHoldingsTable({
  portfolio,
  lots,
  csrfToken,
  showValue,
  colors,
}: {
  portfolio: Portfolio;
  lots: Lot[];
  csrfToken: string;
  showValue: boolean;
  colors: Record<string, string>;
}) {
  const valued = showValue && portfolio.holdings.some((holding) => holding.valuation);
  const columns = valued ? 7 : 4;
  const bySymbol = new Map<string, Lot[]>();
  for (const lot of lots) bySymbol.set(lot.symbol, [...(bySymbol.get(lot.symbol) ?? []), lot]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">
          Your holdings, one row per company. Open a row to see and change its purchases.
        </caption>
        <thead>
          <tr className="border-border border-b">
            <th scope="col" className={`${HEADER} pr-4 pl-1 text-left`}>
              Company
            </th>
            <th scope="col" className={`${HEADER} text-right`}>
              Shares
            </th>
            <th scope="col" className={`${HEADER} text-right`}>
              Average cost
            </th>
            <th scope="col" className={`${HEADER} text-right`}>
              Paid
            </th>
            {valued && (
              <>
                <th scope="col" className={`${HEADER} text-right`}>
                  Latest price
                </th>
                <th scope="col" className={`${HEADER} text-right`}>
                  Value
                </th>
                <th scope="col" className={`${HEADER} pr-1 text-right`}>
                  Gain or loss
                </th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {portfolio.holdings.map((holding) => (
            <HoldingRow
              key={holding.symbol}
              holding={holding}
              lots={bySymbol.get(holding.symbol) ?? []}
              csrfToken={csrfToken}
              valued={valued}
              color={colors[holding.symbol]}
              columns={columns}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

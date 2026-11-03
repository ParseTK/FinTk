import { HoldingCard } from "./HoldingCard";
import type { Lot, Portfolio } from "./types";

/** The holdings as a list of collapsed cards: the phone layout, with no sideways scrolling. */
export function HoldingsCards({
  portfolio,
  lots,
  csrfToken,
  showValue,
}: {
  portfolio: Portfolio;
  lots: Lot[];
  csrfToken: string;
  showValue: boolean;
}) {
  const bySymbol = new Map<string, Lot[]>();
  for (const lot of lots) bySymbol.set(lot.symbol, [...(bySymbol.get(lot.symbol) ?? []), lot]);

  return (
    <ul aria-label="Your holdings" className="space-y-3">
      {portfolio.holdings.map((holding) => (
        <li key={holding.symbol}>
          <HoldingCard
            holding={holding}
            lots={bySymbol.get(holding.symbol) ?? []}
            csrfToken={csrfToken}
            showValue={showValue}
          />
        </li>
      ))}
    </ul>
  );
}

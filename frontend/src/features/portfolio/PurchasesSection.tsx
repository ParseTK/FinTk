import { PurchaseItem } from "./PurchaseItem";
import type { Holding, Lot } from "./types";

/** Every purchase, grouped under its company, each with edit and delete. */
export function PurchasesSection({
  holdings,
  lots,
  csrfToken,
}: {
  holdings: Holding[];
  lots: Lot[];
  csrfToken: string;
}) {
  return (
    <div className="space-y-6">
      {holdings.map((holding) => {
        const own = lots.filter((lot) => lot.symbol === holding.symbol);
        const headingId = `purchases-${holding.symbol}`;
        return (
          <section key={holding.symbol} aria-labelledby={headingId}>
            <h3 id={headingId} className="text-lg font-semibold">
              {holding.symbol}
              {holding.name && (
                <span className="text-fg-muted text-base font-normal">
                  {" "}
                  &middot; {holding.name}
                </span>
              )}
            </h3>
            <ul className="divide-border divide-y">
              {own.map((lot) => (
                <PurchaseItem key={lot.id} lot={lot} csrfToken={csrfToken} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

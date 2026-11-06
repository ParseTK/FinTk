import { Card } from "@/components/ui/Card";
import { formatAmount } from "./format";
import type { HoldingValue } from "./data";
import { CoinLink, Gain, editing, money } from "./HoldingCells";
import { HoldingActions } from "./HoldingActions";

/** The holdings as one labelled card per coin, for screens too small for the table. */
export function HoldingCards({
  holdings,
  csrfToken,
}: {
  holdings: HoldingValue[];
  csrfToken: string;
}) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:hidden" aria-label="Your holdings">
      {holdings.map((row) => (
        <Card as="li" key={row.slug} className="space-y-3 rounded-2xl">
          <p className="text-lg">
            <CoinLink row={row} withSymbol />
          </p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-fg-muted">Amount</dt>
              <dd className="font-medium tabular-nums">{formatAmount(row.amount)}</dd>
            </div>
            <div>
              <dt className="text-fg-muted">Value</dt>
              <dd className="font-medium">{money(row.value)}</dd>
            </div>
            <div>
              <dt className="text-fg-muted">Paid</dt>
              <dd className="font-medium">{row.cost === null ? "—" : money(row.cost)}</dd>
            </div>
            <div>
              <dt className="text-fg-muted">Gain or loss</dt>
              <dd className="font-medium">
                <Gain row={row} />
              </dd>
            </div>
          </dl>
          <HoldingActions {...editing(row, csrfToken)} />
        </Card>
      ))}
    </ul>
  );
}

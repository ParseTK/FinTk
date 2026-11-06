import { Card } from "@/components/ui/Card";
import { formatAmount } from "./format";
import type { HoldingValue } from "./data";
import { CoinLink, Gain, NOT_PRICED, editing, money } from "./HoldingCells";
import { HoldingActions } from "./HoldingActions";

/** The holdings as a real table, for large screens. Edit opens the form in a row of its own. */
export function HoldingsTable({
  holdings,
  csrfToken,
}: {
  holdings: HoldingValue[];
  csrfToken: string;
}) {
  return (
    <Card className="hidden rounded-2xl p-2 sm:p-4 lg:block">
      <table className="w-full text-left">
        <caption className="sr-only">Your holdings, valued at today&apos;s prices</caption>
        <thead>
          <tr className="text-fg-muted text-sm">
            <th scope="col" className="px-3 py-2 font-medium">
              Coin
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Symbol
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Amount
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Price
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Value
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Paid
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Gain or loss
            </th>
            <th scope="col" className="w-48 px-3 py-2 text-right font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((row) => (
            <HoldingActions key={row.slug} {...editing(row, csrfToken)} colSpan={8}>
              <th scope="row" className="px-3 py-3 text-left font-normal">
                <CoinLink row={row} />
              </th>
              <td className="text-fg-muted px-3 py-3 text-sm">{row.coin?.symbol ?? "—"}</td>
              <td className="px-3 py-3 text-right tabular-nums">{formatAmount(row.amount)}</td>
              <td className="px-3 py-3 text-right">
                {row.coin ? money(row.coin.price) : NOT_PRICED}
              </td>
              <td className="px-3 py-3 text-right">{money(row.value)}</td>
              <td className="px-3 py-3 text-right">
                {row.cost === null ? <span className="text-fg-muted">—</span> : money(row.cost)}
              </td>
              <td className="px-3 py-3 text-right">
                <Gain row={row} />
              </td>
            </HoldingActions>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

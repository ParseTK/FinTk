import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { Change } from "@/components/ui/Change";
import { DataCredit } from "@/components/ui/DataCredit";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/LinkButton";
import { formatMoney } from "@/lib/format";
import { formatAmount } from "./format";
import type { HoldingValue, Portfolio } from "./data";
import { HoldingActions } from "./HoldingActions";

const NOT_PRICED = <span className="text-fg-muted">Not priced</span>;
const money = (value: string | null) =>
  value === null ? NOT_PRICED : <span className="tabular-nums">{formatMoney(value)}</span>;

function Gain({ row }: { row: HoldingValue }) {
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

function CoinLink({ row, withSymbol = false }: { row: HoldingValue; withSymbol?: boolean }) {
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
const editing = (row: HoldingValue, csrfToken: string) => ({
  slug: row.slug,
  name: row.coin?.name ?? row.slug,
  symbol: row.coin?.symbol ?? row.slug,
  amount: row.amount,
  cost: row.cost,
  csrfToken,
});

function Summary({ portfolio }: { portfolio: Portfolio }) {
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

/**
 * The portfolio: a summary, then each coin held with its value and, where a cost was entered, its
 * gain or loss. A real table on large screens and one labelled card per coin below that. Edit opens the form
 * in place. Values are not stored anywhere: they were worked out
 * from today's prices when this page was built, and the provider's credit sits above them.
 */
export function PortfolioBody({
  portfolio,
  csrfToken,
}: {
  portfolio: Portfolio;
  csrfToken: string;
}) {
  const { holdings } = portfolio;

  if (holdings.length === 0) {
    return (
      <Card className="rounded-2xl">
        <EmptyState
          title="You have not added any coins yet"
          description="Open a coin's page and enter how much you hold. Use the search box at the top to find one."
          action={
            <LinkButton href="/crypto/search" variant="secondary">
              Search coins
            </LinkButton>
          }
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <DataCredit
        text={portfolio.attribution.text}
        href={portfolio.attribution.url}
        linkText="CoinMarketCap.com"
      />
      {!portfolio.prices_available && (
        <Alert title="Prices are not available right now">
          Your holdings are listed below without values. Try again in a moment.
        </Alert>
      )}
      <Summary portfolio={portfolio} />

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
    </div>
  );
}

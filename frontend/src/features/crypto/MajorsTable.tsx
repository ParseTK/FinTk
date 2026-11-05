import { Card } from "@/components/ui/Card";
import { Change } from "@/components/ui/Change";
import { formatDate } from "@/lib/format";
import { CoinName, coinHref } from "./CoinName";
import { formatCoinPrice } from "./crypto";
import type { MajorCoin } from "./types";

const NOT_AVAILABLE = <span className="text-fg-muted whitespace-nowrap">Not available</span>;

const Percent = ({ value }: { value: string | null }) =>
  value === null ? NOT_AVAILABLE : <Change value={value} />;

/** "since Jan 1, 2026", or null when that day is not known. */
const since = (day: string | null): string | null =>
  day === null ? null : `since ${formatDate(day, "medium")}`;

/**
 * The largest coins and how they have done over 30 days, 90 days, since the start of the year and
 * over the past year, each long change labelled with the day it is measured from. A real table on
 * large screens and a labelled card per coin below that. A change that could not be worked out
 * says so; it is never shown as zero.
 */
export function MajorsTable({
  coins,
  yearStart,
  pastYearStart,
  caption,
  linkCoins = false,
}: {
  coins: readonly MajorCoin[];
  yearStart: string | null;
  pastYearStart: string | null;
  caption: string;
  /** Link each name to the coin's page (only while that page exists). */
  linkCoins?: boolean;
}) {
  const columns = [
    { key: "change_30d", label: "30 days", note: null },
    { key: "change_90d", label: "90 days", note: null },
    { key: "change_year_to_date", label: "Year to date", note: since(yearStart) },
    { key: "change_past_year", label: "Past year", note: since(pastYearStart) },
  ] as const;

  return (
    <>
      <Card className="hidden rounded-2xl p-2 sm:p-4 lg:block">
        <table className="w-full text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="text-fg-muted text-sm">
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Rank
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Name
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Price
              </th>
              {columns.map((column) => (
                <th key={column.key} scope="col" className="px-3 py-2 text-right font-medium">
                  {column.label}
                  {column.note && (
                    <span className="block text-xs font-normal whitespace-nowrap">
                      {column.note}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {coins.map((coin) => (
              <tr key={coin.slug} className="border-border border-t">
                <td className="text-fg-muted px-3 py-3 text-right tabular-nums">{coin.rank}</td>
                <th scope="row" className="px-3 py-3 text-left font-normal">
                  <CoinName
                    name={coin.name}
                    symbol={coin.symbol}
                    href={linkCoins ? coinHref(coin.slug) : undefined}
                  />
                </th>
                <td className="px-3 py-3 text-right tabular-nums">{formatCoinPrice(coin.price)}</td>
                {columns.map((column) => (
                  <td key={column.key} className="px-3 py-3 text-right">
                    <Percent value={coin[column.key]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <ul aria-label={caption} className="grid gap-3 md:grid-cols-2 lg:hidden">
        {coins.map((coin) => (
          <li key={coin.slug}>
            <Card as="article" className="space-y-3 rounded-2xl">
              <h3>
                <span className="text-fg-muted mr-2 text-sm tabular-nums">
                  <span className="sr-only">Rank </span>
                  {coin.rank}
                </span>
                <CoinName
                  name={coin.name}
                  symbol={coin.symbol}
                  href={linkCoins ? coinHref(coin.slug) : undefined}
                />
              </h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-fg-muted">Price</dt>
                  <dd className="mt-0.5 text-base tabular-nums">{formatCoinPrice(coin.price)}</dd>
                </div>
                {columns.map((column) => (
                  <div key={column.key}>
                    <dt className="text-fg-muted">
                      {column.label}
                      {column.note && <span className="block text-xs">{column.note}</span>}
                    </dt>
                    <dd className="mt-0.5 text-base">
                      <Percent value={coin[column.key]} />
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}

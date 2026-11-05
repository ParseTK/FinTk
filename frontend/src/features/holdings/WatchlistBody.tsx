import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { Change } from "@/components/ui/Change";
import { DataCredit } from "@/components/ui/DataCredit";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/LinkButton";
import { formatCoinPrice, compactUsd } from "@/features/crypto";
import type { Watchlist, WatchlistItem } from "./data";
import { RemoveButton } from "./RemoveButton";

const NOT_PRICED = <span className="text-fg-muted">Not priced</span>;

function Name({ item }: { item: WatchlistItem }) {
  return (
    <>
      <Link
        href={`/crypto/coins/${item.slug}`}
        className="font-medium underline-offset-2 hover:underline"
      >
        {item.coin ? item.coin.name : item.slug}
      </Link>{" "}
      {item.coin && <span className="text-fg-muted text-sm">{item.coin.symbol}</span>}
    </>
  );
}

/**
 * The watched coins with today's price and 24 hour change, as a table on large screens and a card
 * per coin below that. A coin that is not priced right now (it left the list, or prices are down)
 * stays listed and says so, so nothing quietly disappears.
 */
export function WatchlistBody({
  watchlist,
  csrfToken,
}: {
  watchlist: Watchlist;
  csrfToken: string;
}) {
  const { items } = watchlist;

  if (items.length === 0) {
    return (
      <Card className="rounded-2xl">
        <EmptyState
          title="You are not watching any coins yet"
          description="Open a coin's page and choose Watch. Use the search box at the top to find one."
          action={
            <LinkButton href="/crypto/search" variant="secondary">
              Search coins
            </LinkButton>
          }
        />
      </Card>
    );
  }

  const remove = (item: WatchlistItem) => (
    <RemoveButton
      what={`${item.coin?.name ?? item.slug} from your watchlist`}
      path={`/api/v1/watchlist/${encodeURIComponent(item.slug)}`}
      csrfToken={csrfToken}
    />
  );

  return (
    <div className="space-y-6">
      <DataCredit
        text={watchlist.attribution.text}
        href={watchlist.attribution.url}
        linkText="CoinMarketCap.com"
      />
      {!watchlist.prices_available && (
        <Alert title="Prices are not available right now">
          Your coins are listed below without prices. Try again in a moment.
        </Alert>
      )}

      <Card className="hidden rounded-2xl p-2 sm:p-4 lg:block">
        <table className="w-full text-left">
          <caption className="sr-only">Coins you are watching, at today&apos;s prices</caption>
          <thead>
            <tr className="text-fg-muted text-sm">
              <th scope="col" className="px-3 py-2 font-medium">
                Coin
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Price
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                24 hours
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Market cap
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.slug} className="border-border border-t">
                <th scope="row" className="px-3 py-3 text-left font-normal">
                  <Name item={item} />
                </th>
                <td className="px-3 py-3 text-right tabular-nums">
                  {item.coin ? formatCoinPrice(item.coin.price) : NOT_PRICED}
                </td>
                <td className="px-3 py-3 text-right">
                  {item.coin?.change_24h != null ? <Change value={item.coin.change_24h} /> : "—"}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {compactUsd(item.coin?.market_cap) ?? "—"}
                </td>
                <td className="px-3 py-3 text-right">{remove(item)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <ul className="grid gap-4 sm:grid-cols-2 lg:hidden" aria-label="Coins you are watching">
        {items.map((item) => (
          <Card as="li" key={item.slug} className="space-y-3 rounded-2xl">
            <p className="text-lg">
              <Name item={item} />
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-fg-muted">Price</dt>
                <dd className="font-medium tabular-nums">
                  {item.coin ? formatCoinPrice(item.coin.price) : NOT_PRICED}
                </dd>
              </div>
              <div>
                <dt className="text-fg-muted">24 hours</dt>
                <dd className="font-medium">
                  {item.coin?.change_24h != null ? <Change value={item.coin.change_24h} /> : "—"}
                </dd>
              </div>
            </dl>
            <div className="flex justify-end">{remove(item)}</div>
          </Card>
        ))}
      </ul>
    </div>
  );
}

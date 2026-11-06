import Link from "next/link";
import type { ReactNode } from "react";
import { Alert } from "@/components/ui/Alert";
import { Change } from "@/components/ui/Change";
import { DataCredit } from "@/components/ui/DataCredit";
import {
  CoinPicker,
  compactUsd,
  formatCoinPrice,
  getCoin,
  updatedLabel,
  type CoinDetail,
  type PickedCoin,
} from "@/features/crypto";
import { isEnabled } from "@/lib/flags";
import { COMPARE_HASH, COMPARE_PARAM, COMPARE_PATH, MAX_COMPARED } from "./compare";

const NOT_AVAILABLE = <span className="text-fg-muted">Not available</span>;

type Row = readonly [label: string, cell: (coin: CoinDetail) => ReactNode];

const change = (value: string | null | undefined) =>
  value == null || value === "" ? NOT_AVAILABLE : <Change value={value} />;
const dollars = (value: string | null | undefined) => compactUsd(value) ?? NOT_AVAILABLE;

const ROWS: readonly Row[] = [
  ["Price", (coin) => formatCoinPrice(coin.price)],
  ["Market cap", (coin) => dollars(coin.market_cap)],
  ["Volume (24 hours)", (coin) => dollars(coin.volume_24h)],
  ["Change, 1 hour", (coin) => change(coin.change_1h)],
  ["Change, 24 hours", (coin) => change(coin.change_24h)],
  ["Change, 7 days", (coin) => change(coin.change_7d)],
  ["Change, 30 days", (coin) => change(coin.change_30d)],
  ["Change, 90 days", (coin) => change(coin.change_90d)],
];

/**
 * Compare two to four coins side by side: price, size and the changes the data provider reports.
 * The coins come from the address, so a comparison is a link. Figures are read on the server and
 * shown as the provider reports them (nothing is calculated or ranked here). A coin that cannot be
 * found is named and can be removed, and one failure does not hide the others.
 */
export async function CompareSection({ slugs }: { slugs: readonly string[] }) {
  const results = await Promise.all(slugs.map((slug) => getCoin(slug)));
  const coins: CoinDetail[] = [];
  const picked: PickedCoin[] = [];
  const notFound: string[] = [];
  let unavailable = false;

  results.forEach((result, index) => {
    const slug = slugs[index]!;
    if (result.status === "ok") {
      coins.push(result.coin);
      picked.push({ slug, label: `${result.coin.name} ${result.coin.symbol}` });
    } else {
      if (result.status === "not_found") notFound.push(slug);
      else unavailable = true;
      picked.push({ slug, label: slug });
    }
  });

  const linkNames = isEnabled("crypto_search");
  const first = coins[0];
  const updated = first ? updatedLabel(first.as_of) : null;

  return (
    <section
      id={COMPARE_HASH}
      aria-labelledby="compare-heading"
      className="border-border bg-surface scroll-mt-6 space-y-4 rounded-2xl border p-5 sm:p-6"
    >
      <div className="space-y-1">
        <h2 id="compare-heading" className="text-xl font-semibold tracking-tight">
          Compare coins
        </h2>
        <p className="text-fg-muted text-sm">
          Put two to four coins side by side. The figures are the provider&apos;s own, and the
          choice is kept in the page address, so you can share a comparison as a link.
        </p>
      </div>

      <CoinPicker
        selected={picked}
        max={MAX_COMPARED}
        basePath={COMPARE_PATH}
        param={COMPARE_PARAM}
        hash={COMPARE_HASH}
      />

      {notFound.length > 0 && (
        <Alert title="Some coins were not found">
          FinTk does not cover: {notFound.join(", ")}. Remove them above, or search for another
          coin.
        </Alert>
      )}
      {unavailable && (
        <Alert title="Prices are unavailable right now">
          Some figures could not be loaded. Try again in a few minutes.
        </Alert>
      )}
      {slugs.length === 0 && (
        <p className="text-fg-muted text-sm">Choose at least two coins to see them compared.</p>
      )}
      {slugs.length === 1 && coins.length === 1 && (
        <p className="text-fg-muted text-sm">Add one more coin to compare.</p>
      )}

      {coins.length >= 2 && (
        <>
          <div
            role="region"
            aria-label="Comparison table"
            tabIndex={0}
            className="border-border relative overflow-x-auto rounded-xl border"
          >
            <table className="w-full min-w-[32rem] text-left text-sm">
              <caption className="sr-only">
                Figures for {coins.map((coin) => coin.name).join(", ")}
              </caption>
              <thead>
                <tr className="border-border border-b">
                  <th scope="col" className="text-fg-muted px-4 py-3 font-medium">
                    Figure
                  </th>
                  {coins.map((coin) => (
                    <th key={coin.slug} scope="col" className="px-4 py-3 text-right font-semibold">
                      {linkNames ? (
                        <Link
                          href={`/crypto/coins/${coin.slug}`}
                          className="text-brand underline underline-offset-2 hover:no-underline"
                        >
                          {coin.name}
                        </Link>
                      ) : (
                        coin.name
                      )}{" "}
                      <span className="text-fg-muted font-normal">{coin.symbol}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map(([label, cell]) => (
                  <tr key={label} className="border-border border-b last:border-0">
                    <th scope="row" className="text-fg-muted px-4 py-3 font-medium">
                      {label}
                    </th>
                    {coins.map((coin) => (
                      <td key={coin.slug} className="px-4 py-3 text-right tabular-nums">
                        {cell(coin)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {first && (
            <div className="space-y-1">
              <DataCredit
                text={first.attribution.text}
                href={first.attribution.url}
                linkText="CoinMarketCap.com"
              />
              <p className="text-fg-muted text-sm">
                Prices in US dollars{updated ? `, updated ${updated}` : ""}. For personal,
                non-commercial use. This is information, not investment advice.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

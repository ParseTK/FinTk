import clsx from "clsx";
import { Change } from "@/components/ui/Change";
import { DataCredit } from "@/components/ui/DataCredit";
import { formatCoinPrice } from "./crypto";
import type { CryptoMarkets } from "./types";

type ChangeField =
  | "change_1h"
  | "change_24h"
  | "change_7d"
  | "change_30d"
  | "change_90d"
  | "change_year_to_date"
  | "change_past_year";

/** Whichever of the reported changes a coin has; a period it does not have is simply left out. */
type Changes = { [Field in ChangeField]?: string | null };

const PERIODS: ReadonlyArray<readonly [label: string, field: ChangeField]> = [
  ["1 hour", "change_1h"],
  ["24 hours", "change_24h"],
  ["7 days", "change_7d"],
  ["30 days", "change_30d"],
  ["90 days", "change_90d"],
  ["Year to date", "change_year_to_date"],
  ["Past year", "change_past_year"],
];

export interface ChangeRow {
  label: string;
  /** As the API sent it, in percent points. */
  change: string;
  value: number;
}

/**
 * The periods a coin has a usable change for, in the order above. A missing, blank or unreadable
 * change is left out, never shown as zero.
 */
export function changeRows(coin: Changes): ChangeRow[] {
  const rows: ChangeRow[] = [];
  for (const [label, field] of PERIODS) {
    const change = coin[field];
    if (change == null || change.trim() === "") continue;
    const value = Number(change);
    if (Number.isFinite(value)) rows.push({ label, change, value });
  }
  return rows;
}

/**
 * One coin's price now and how much it has changed over each period, as bars that start from a
 * shared zero line (a rise to the right, a fall to the left). Only what the provider reports is
 * shown; there is no line between the periods, because nothing is known about what happened in
 * between. The bars are a picture of the numbers beside them, which carry a sign and an arrow, so
 * nothing depends on seeing the bars or their colour. Shows nothing when no change is available.
 */
export function CoinChanges({
  name,
  price,
  coin,
  attribution,
  credit = true,
}: {
  name: string;
  price: string;
  coin: Changes;
  attribution: { text: string; url: string };
  /** Show the provider credit under the card. Off where the page already shows it above. */
  credit?: boolean;
}) {
  const rows = changeRows(coin);
  if (rows.length === 0) return null;
  const largest = Math.max(...rows.map((row) => Math.abs(row.value)), 0.01);

  return (
    <figure className="border-border bg-surface-raised/70 rounded-2xl border p-5">
      <figcaption>
        <p className="text-fg-muted text-xs font-semibold tracking-wide uppercase">{name}</p>
        <p className="text-3xl font-bold tabular-nums">{formatCoinPrice(price)}</p>
      </figcaption>

      <table className="mt-4 w-full text-sm">
        <caption className="sr-only">{name} price change over each period, up to now</caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">Period</th>
            <th scope="col">Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, change, value }) => (
            <tr key={label}>
              <th scope="row" className="text-fg-muted w-28 py-1.5 pr-3 text-left font-normal">
                {label}
              </th>
              <td className="py-1.5">
                {/* Number above the bar on phones, side by side from the small breakpoint up. */}
                <div className="flex flex-col-reverse items-start gap-1.5 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3">
                  <div aria-hidden="true" className="relative h-2 w-full">
                    <span className="bg-border-strong absolute inset-y-[-3px] left-1/2 w-px" />
                    <span
                      className={clsx(
                        "absolute inset-y-0 rounded-full",
                        value >= 0 ? "bg-gain left-1/2" : "bg-loss right-1/2",
                      )}
                      style={{ width: `${Math.min(50, (Math.abs(value) / largest) * 50)}%` }}
                    />
                  </div>
                  <Change value={change} className="sm:w-24 sm:justify-end" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-fg-muted mt-3 text-xs">
        Each bar is the change from the price on that day to now, as reported. There is no price
        history between these dates, so none is drawn.
      </p>
      {credit && (
        <DataCredit
          text={attribution.text}
          href={attribution.url}
          linkText="CoinMarketCap.com"
          className="mt-2"
        />
      )}
    </figure>
  );
}

/** Bitcoin's card, for the pages that already have the market figures. Nothing without them. */
export function BitcoinChanges({
  markets,
  credit = true,
}: {
  markets: CryptoMarkets | null;
  credit?: boolean;
}) {
  const coin = markets?.majors.find((major) => major.symbol === "BTC");
  if (!markets || !coin) return null;
  return (
    <CoinChanges
      name="Bitcoin"
      price={coin.price}
      coin={coin}
      attribution={markets.attribution}
      credit={credit}
    />
  );
}

import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { DataCredit } from "@/components/ui/DataCredit";
import { ErrorState } from "@/components/ui/ErrorState";
import { Feature } from "@/components/ui/Feature";
import { formatNumber } from "@/lib/format";
import { CoinChanges } from "./CoinChanges";
import { compactUsd, updatedLabel } from "./crypto";
import { getCoin } from "./data";
import type { CoinDetail } from "./types";

const NOT_AVAILABLE = <span className="text-fg-muted">Not available</span>;

/** A coin count: whole coins with separators, or "Not available". Never zero for a missing one. */
function Supply({ value, symbol }: { value: string | null; symbol: string }) {
  if (value === null || value.trim() === "") return NOT_AVAILABLE;
  return (
    <span className="tabular-nums">
      {formatNumber(value, 0)} {symbol}
    </span>
  );
}

function Money({ value }: { value: string | null }) {
  const text = compactUsd(value);
  return text === null ? NOT_AVAILABLE : <span className="tabular-nums">{text}</span>;
}

function Stats({ coin }: { coin: CoinDetail }) {
  const rows: ReadonlyArray<readonly [label: string, value: React.ReactNode]> = [
    ["Market cap", <Money key="cap" value={coin.market_cap} />],
    ["Fully diluted market cap", <Money key="fd" value={coin.fully_diluted_market_cap} />],
    ["Volume (24 hours)", <Money key="vol" value={coin.volume_24h} />],
    [
      "Circulating supply",
      <Supply key="circ" value={coin.circulating_supply} symbol={coin.symbol} />,
    ],
    ["Total supply", <Supply key="total" value={coin.total_supply} symbol={coin.symbol} />],
    [
      "Maximum supply",
      coin.max_supply === null ? (
        <span key="max" className="text-fg-muted">
          No fixed maximum reported
        </span>
      ) : (
        <Supply key="max" value={coin.max_supply} symbol={coin.symbol} />
      ),
    ],
  ];
  return (
    <Card as="section" aria-labelledby="stats-heading" className="space-y-3 rounded-2xl">
      <h2 id="stats-heading" className="text-xl font-semibold">
        Key figures
      </h2>
      <dl className="divide-border divide-y">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
            <dt className="text-fg-muted">{label}</dt>
            <dd className="text-right font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

/**
 * One coin: its price, how it has changed over each reported period, and its market value and
 * supply. A server component. A coin this site does not cover is a 404; a coin whose figures cannot
 * be loaded right now gets a plain message instead, so a good link never reads as "does not exist".
 * The provider's credit sits above the figures, as the licence requires.
 */
export async function CoinPage({
  slug,
  extras,
}: {
  slug: string;
  /** Something to show under the figures, given the coin (the holdings panel, when it is on). */
  extras?: (coin: { slug: string; name: string; symbol: string }) => ReactNode;
}) {
  const result = await getCoin(slug);
  if (result.status === "not_found") notFound();

  if (result.status === "unavailable") {
    return (
      <Container className="py-8">
        <ErrorState
          title="This coin's figures are not available right now"
          description="Please try again in a moment."
        />
      </Container>
    );
  }

  const { coin } = result;
  const updated = updatedLabel(coin.as_of);

  return (
    <Container className="space-y-6 py-8">
      <p className="text-sm">
        <Feature flag="crypto_markets" fallback={<Link href="/crypto">Crypto overview</Link>}>
          <Link
            href="/crypto/markets"
            className="text-brand font-medium underline underline-offset-2"
          >
            Back to the markets
          </Link>
        </Feature>
      </p>
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          {coin.name} <span className="text-fg-muted text-2xl font-semibold">{coin.symbol}</span>
        </h1>
        <p className="text-fg-muted">Ranked number {coin.rank} by market value.</p>
        <DataCredit
          text={coin.attribution.text}
          href={coin.attribution.url}
          linkText="CoinMarketCap.com"
        />
        <p className="text-fg-muted text-sm">
          Prices in US dollars{updated ? `, updated ${updated}` : ""}. For personal, non-commercial
          use. This is information, not investment advice.
        </p>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <CoinChanges
          name={coin.name}
          price={coin.price}
          coin={coin}
          attribution={coin.attribution}
          credit={false}
        />
        <Stats coin={coin} />
      </div>
      {extras?.({ slug: coin.slug, name: coin.name, symbol: coin.symbol })}
    </Container>
  );
}

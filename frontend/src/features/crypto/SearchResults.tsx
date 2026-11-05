import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { DataCredit } from "@/components/ui/DataCredit";
import { searchCoins } from "./data";

const MAX_QUERY = 40;

/**
 * The /crypto/search page: the search box, and the matching coins as links to their pages. A server
 * component that reads the query from the address, so it works without JavaScript and a result
 * list can be shared as a link. The query is capped and shown as plain text.
 */
export async function SearchResults({ query }: { query: string | undefined }) {
  const text = (query ?? "").trim().slice(0, MAX_QUERY);
  const found = text === "" ? null : await searchCoins(text, 20);
  const hits = found?.results ?? [];

  return (
    <Container className="space-y-6 py-8">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Search coins</h1>
        <p className="text-fg-muted">
          Use the search box at the top of the page to find a coin by its name or symbol among the
          largest coins.
        </p>
      </header>

      {text === "" ? null : found === null ? (
        <ErrorState
          title="Search is not available right now"
          description="Please try again in a moment."
        />
      ) : hits.length === 0 ? (
        <Card className="rounded-2xl">
          <EmptyState
            title={`No coins match "${text}"`}
            description="Only the largest coins are covered. Try a name or symbol such as Bitcoin or ETH."
          />
        </Card>
      ) : (
        <section aria-labelledby="results-heading" className="space-y-3">
          <h2 id="results-heading" className="text-xl font-semibold">
            {hits.length} {hits.length === 1 ? "match" : "matches"} for &ldquo;{text}&rdquo;
          </h2>
          <Card className="rounded-2xl p-2 sm:p-4">
            <ul className="divide-border divide-y">
              {hits.map((coin) => (
                <li key={coin.slug}>
                  <Link
                    href={`/crypto/coins/${coin.slug}`}
                    className="hover:bg-surface flex items-baseline justify-between gap-3 rounded-lg px-3 py-3"
                  >
                    <span>
                      <span className="font-medium">{coin.name}</span>{" "}
                      <span className="text-fg-muted text-sm">{coin.symbol}</span>
                    </span>
                    <span className="text-fg-muted text-sm">Rank {coin.rank}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <DataCredit
            text={found.attribution.text}
            href={found.attribution.url}
            linkText="CoinMarketCap.com"
          />
        </section>
      )}
    </Container>
  );
}

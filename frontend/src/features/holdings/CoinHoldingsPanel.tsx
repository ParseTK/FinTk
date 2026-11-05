import { Card } from "@/components/ui/Card";
import { getSession } from "@/features/auth";
import { getPortfolio, getWatchlist } from "./data";
import { HoldingEditor } from "./HoldingEditor";
import { WatchButton } from "./WatchButton";

/**
 * "Track this coin" on a coin's page: the Watch button and the person's own holding. Signed out,
 * both are links to sign in. If their saved lists cannot be read right now, no state is guessed:
 * the panel says so instead of showing a button that might be wrong.
 */
export async function CoinHoldingsPanel({
  slug,
  name,
  symbol,
}: {
  slug: string;
  name: string;
  symbol: string;
}) {
  const session = await getSession();
  const csrfToken = session.user ? (session.csrfToken ?? undefined) : undefined;
  const signInNext = `/crypto/coins/${slug}`;

  let watched = false;
  let current: { amount: string; cost: string | null } | undefined;
  if (csrfToken) {
    const [watchlist, portfolio] = await Promise.all([getWatchlist(), getPortfolio()]);
    if (watchlist.status !== "ok" || portfolio.status !== "ok") {
      return (
        <Card as="section" aria-label="Track this coin" className="rounded-2xl">
          <p className="text-fg-muted">Your saved coins are not available right now.</p>
        </Card>
      );
    }
    watched = watchlist.data.items.some((item) => item.slug === slug);
    const held = portfolio.data.holdings.find((row) => row.slug === slug);
    current = held ? { amount: held.amount, cost: held.cost } : undefined;
  }

  return (
    <Card as="section" aria-labelledby="track-heading" className="space-y-5 rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="track-heading" className="text-xl font-semibold">
          Track {name}
        </h2>
        <WatchButton
          slug={slug}
          name={name}
          watched={watched}
          csrfToken={csrfToken}
          signInNext={signInNext}
        />
      </div>
      <HoldingEditor
        slug={slug}
        name={name}
        symbol={symbol}
        csrfToken={csrfToken}
        signInNext={signInNext}
        current={current}
      />
    </Card>
  );
}

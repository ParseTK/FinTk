import { redirect } from "next/navigation";
import { ErrorState } from "@/components/ui/ErrorState";
import { getSession } from "@/features/auth";
import { getPortfolio, getWatchlist } from "./data";
import { HoldingsShell } from "./HoldingsShell";
import { PortfolioBody } from "./PortfolioBody";
import { WatchlistBody } from "./WatchlistBody";

const UNAVAILABLE = (
  <ErrorState
    title="Your coins are not available right now"
    description="Please try again in a moment."
  />
);

/**
 * /holdings: the signed-in person's portfolio. Someone who is not signed in is sent to sign in and
 * brought back here. The figures are theirs alone, so nothing here is cached or shared.
 */
export async function PortfolioPage() {
  const session = await getSession();
  if (!session.user || !session.csrfToken) {
    if (!session.reachable) {
      return (
        <HoldingsShell title="Portfolio" intro="The coins you hold.">
          {UNAVAILABLE}
        </HoldingsShell>
      );
    }
    redirect("/sign-in?next=%2Fholdings");
  }
  const loaded = await getPortfolio();
  if (loaded.status === "signed-out") redirect("/sign-in?next=%2Fholdings");

  return (
    <HoldingsShell
      title="Portfolio"
      intro="The coins you hold, valued at today's prices. Your amounts are saved; prices are not."
    >
      {loaded.status === "ok" ? (
        <PortfolioBody portfolio={loaded.data} csrfToken={session.csrfToken} />
      ) : (
        UNAVAILABLE
      )}
    </HoldingsShell>
  );
}

/** /holdings/watchlist: the coins the signed-in person is watching. */
export async function WatchlistPage() {
  const session = await getSession();
  if (!session.user || !session.csrfToken) {
    if (!session.reachable) {
      return (
        <HoldingsShell title="Watchlist" intro="The coins you are watching.">
          {UNAVAILABLE}
        </HoldingsShell>
      );
    }
    redirect("/sign-in?next=%2Fholdings%2Fwatchlist");
  }
  const loaded = await getWatchlist();
  if (loaded.status === "signed-out") redirect("/sign-in?next=%2Fholdings%2Fwatchlist");

  return (
    <HoldingsShell title="Watchlist" intro="The coins you are watching, at today's prices.">
      {loaded.status === "ok" ? (
        <WatchlistBody watchlist={loaded.data} csrfToken={session.csrfToken} />
      ) : (
        UNAVAILABLE
      )}
    </HoldingsShell>
  );
}

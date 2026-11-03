import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/LinkButton";
import { getSession } from "@/features/auth";
import { getWatchlist, WatchlistTable } from "@/features/watchlist";

export const metadata: Metadata = { title: "Watchlist", robots: { index: false } };

export default async function WatchlistPage() {
  const { user, csrfToken } = await getSession();
  if (!user || !csrfToken) redirect(`/sign-in?next=${encodeURIComponent("/watchlist")}`);
  const items = await getWatchlist();

  return (
    <Container size="narrow" className="py-8">
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Watchlist</h1>
        {items === null ? (
          <Alert variant="error" title="We could not load your watchlist">
            Please try again in a moment.
          </Alert>
        ) : items.length === 0 ? (
          <Card>
            <EmptyState
              title="Nothing on your watchlist yet"
              description="Search for a company and choose Watch to keep it here."
              action={<LinkButton href="/search">Search companies</LinkButton>}
              headingLevel={2}
            />
          </Card>
        ) : (
          <Card>
            <WatchlistTable items={items} csrfToken={csrfToken} />
          </Card>
        )}
      </div>
    </Container>
  );
}

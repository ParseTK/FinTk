import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { getMarketNews } from "./data";
import { NewsList } from "./NewsList";

/**
 * The /news page body. A server component that waits for the announcements itself, so the heading
 * can be shown first (wrap it in Suspense).
 */
export async function MarketNewsSection() {
  const news = await getMarketNews();
  if (news === null) {
    return (
      <ErrorState
        title="News is not available right now"
        description="The official sources could not be reached. Please try again in a moment."
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-fg-muted text-sm">{news.basis}</p>
      {news.unavailable.length > 0 && (
        <Alert title="Some sources are unavailable">
          Could not reach: {news.unavailable.join(", ")}. What is shown below is complete only for
          the other sources.
        </Alert>
      )}
      <Card className="rounded-2xl">
        {news.items.length > 0 ? (
          <NewsList items={news.items} label="Official announcements, newest first" />
        ) : (
          <EmptyState title="No announcements yet" />
        )}
      </Card>
    </div>
  );
}

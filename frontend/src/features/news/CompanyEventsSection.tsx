import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { getCompanyNews } from "./data";
import { NewsList } from "./NewsList";

const HEADING_ID = "events-heading";

function Heading() {
  return (
    <h2 id={HEADING_ID} className="text-xl font-semibold">
      Recent company events
    </h2>
  );
}

export function CompanyEventsSkeleton() {
  return (
    <Card as="section" aria-labelledby={HEADING_ID} className="space-y-3">
      <Heading />
      <p role="status" className="sr-only">
        Loading company events
      </p>
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-24 w-full" />
    </Card>
  );
}

/** What the company itself reported to the SEC on Form 8-K, newest first, each with a link. */
export async function CompanyEventsSection({ symbol }: { symbol: string }) {
  const news = await getCompanyNews(symbol);

  return (
    <Card as="section" aria-labelledby={HEADING_ID} className="space-y-3">
      <Heading />
      {news === null ? (
        <p className="text-fg-muted">Company events are not available right now.</p>
      ) : news.items.length === 0 ? (
        <p className="text-fg-muted">No recent events were reported by this company.</p>
      ) : (
        <>
          <p className="text-fg-muted text-sm">
            Reported by the company itself to the SEC (Form 8-K), titled with the SEC&apos;s own
            names for each kind of event. Nothing here is our opinion or a forecast.
          </p>
          <NewsList items={news.items} label={`${symbol} events, newest first`} />
        </>
      )}
    </Card>
  );
}

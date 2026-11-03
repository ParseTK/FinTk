import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/format";
import { getSeasonality } from "./data";
import { SeasonalityGrid } from "./SeasonalityGrid";

const HEADING_ID = "seasonality-heading";

function Heading() {
  return (
    <h2 id={HEADING_ID} className="text-xl font-semibold">
      Seasonality
    </h2>
  );
}

/** Shown while the first request for a company is stored (it can take a moment). */
export function SeasonalitySectionSkeleton() {
  return (
    <Card as="section" aria-labelledby={HEADING_ID} className="space-y-3">
      <Heading />
      <p role="status" className="sr-only">
        Loading monthly returns
      </p>
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-48 w-full" />
    </Card>
  );
}

/**
 * How each calendar month has performed, year by year. A server component: it waits for the price
 * history itself, so the page around it can be shown without waiting (wrap it in Suspense).
 */
export async function SeasonalitySection({ symbol }: { symbol: string }) {
  const data = await getSeasonality(symbol);

  if (data === null) {
    return (
      <Card as="section" aria-labelledby={HEADING_ID} className="space-y-3">
        <Heading />
        <p className="text-fg-muted">
          Monthly returns are not available right now. Please try again shortly.
        </p>
      </Card>
    );
  }
  if (data.years.length === 0 || data.start === null) {
    return (
      <Card as="section" aria-labelledby={HEADING_ID} className="space-y-3">
        <Heading />
        <p className="text-fg-muted">No price history is available for this company.</p>
      </Card>
    );
  }

  const starts = formatDate(
    `${data.start.year}-${String(data.start.month).padStart(2, "0")}-01`,
    "month-year",
  );
  return (
    <Card as="section" aria-labelledby={HEADING_ID} className="space-y-3">
      <Heading />
      {data.source === "sample" && (
        <Alert title="Sample data">
          These figures are generated to demonstrate the page. They are not this company&apos;s real
          price history.
        </Alert>
      )}
      <p className="text-fg-muted text-sm">
        {data.basis} Price data starts {starts}, so the first return is the month after.
      </p>
      <SeasonalityGrid data={data} />
      <p className="text-fg-muted text-sm">
        Source: {data.source === "sample" ? "sample data" : data.source}. Past results do not
        predict future ones.
      </p>
    </Card>
  );
}

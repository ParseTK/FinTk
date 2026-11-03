import type { Metadata } from "next";
import { Suspense } from "react";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Skeleton } from "@/components/ui/Skeleton";
import { MarketsOverview } from "@/features/markets";

export const metadata: Metadata = {
  title: "Markets",
  description: "How the major indices and market sectors have performed, from month-end closes.",
};

export default function MarketsPage() {
  return (
    <Container className="py-8">
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Markets</h1>
          <p className="text-fg-muted">How the major indices and sectors have been doing.</p>
        </header>
        {/* The first visit can wait on price history being stored, so the heading shows first. */}
        <Suspense
          fallback={
            <Card className="space-y-3" aria-busy="true">
              <p role="status" className="sr-only">
                Loading market figures
              </p>
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-40 w-full" />
            </Card>
          }
        >
          <MarketsOverview />
        </Suspense>
      </div>
    </Container>
  );
}

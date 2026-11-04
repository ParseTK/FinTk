import { Suspense } from "react";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Skeleton } from "@/components/ui/Skeleton";
import { CryptoOverview } from "./CryptoOverview";

/**
 * The crypto page: a heading, then the overview, which streams in behind a placeholder. Shared by
 * the /crypto page and the home page in Crypto mode so the two cannot drift apart.
 */
export function CryptoPageBody({ title, intro }: { title: string; intro: string }) {
  return (
    <Container className="py-8">
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-fg-muted">{intro}</p>
        </header>
        <Suspense
          fallback={
            <Card className="space-y-3" aria-busy="true">
              <p role="status" className="sr-only">
                Loading crypto prices
              </p>
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-40 w-full" />
            </Card>
          }
        >
          <CryptoOverview />
        </Suspense>
      </div>
    </Container>
  );
}

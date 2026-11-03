import type { Metadata } from "next";
import { Suspense } from "react";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Skeleton } from "@/components/ui/Skeleton";
import { CryptoOverview } from "@/features/crypto";

export const metadata: Metadata = {
  title: "Crypto",
  description: "The largest cryptocurrencies by market cap, with market totals and Fear and Greed.",
};

export default function CryptoPage() {
  return (
    <Container className="py-8">
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Crypto</h1>
          <p className="text-fg-muted">The largest coins and how the market is feeling.</p>
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

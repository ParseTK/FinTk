import type { Metadata } from "next";
import { Suspense } from "react";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Skeleton } from "@/components/ui/Skeleton";
import { MarketNewsSection } from "@/features/news";

export const metadata: Metadata = {
  title: "News",
  description: "Official announcements from the Federal Reserve and the SEC. No opinions.",
};

export default function NewsPage() {
  return (
    <Container size="narrow" className="py-8">
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">News</h1>
          <p className="text-fg-muted">What the official sources have announced, as published.</p>
        </header>
        <Suspense
          fallback={
            <Card className="space-y-3" aria-busy="true">
              <p role="status" className="sr-only">
                Loading news
              </p>
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-40 w-full" />
            </Card>
          }
        >
          <MarketNewsSection />
        </Suspense>
      </div>
    </Container>
  );
}

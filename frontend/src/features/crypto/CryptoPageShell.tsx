import type { ReactNode } from "react";
import { Suspense } from "react";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * The frame every crypto page shares: a heading and one line of context, then the body, which streams
 * in behind a placeholder (it waits on the API, so the heading can show first).
 */
export function CryptoPageShell({
  title,
  intro,
  loadingLabel,
  children,
}: {
  title: string;
  intro: string;
  /** Read out while the body loads, for example "Loading crypto prices". */
  loadingLabel: string;
  children: ReactNode;
}) {
  return (
    <Container className="py-8">
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-fg-muted">{intro}</p>
        </header>
        <Suspense
          fallback={
            <Card className="min-h-screen space-y-3" aria-busy="true">
              <p role="status" className="sr-only">
                {loadingLabel}
              </p>
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-40 w-full" />
            </Card>
          }
        >
          {children}
        </Suspense>
      </div>
    </Container>
  );
}

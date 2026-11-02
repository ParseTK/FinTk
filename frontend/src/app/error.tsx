"use client";

import { ErrorState } from "@/components/ui/ErrorState";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorState
      headingLevel={1}
      description="We could not load market data. Please try again."
      onRetry={reset}
    />
  );
}

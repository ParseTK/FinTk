import clsx from "clsx";
import { Button } from "./Button";
import type { HeadingLevel } from "./EmptyState";

export interface ErrorStateProps {
  title?: string;
  description?: string;
  /** When provided, a retry button is shown. */
  onRetry?: () => void;
  retryLabel?: string;
  /** Use 1 only when this state replaces the whole page. Default 2. */
  headingLevel?: HeadingLevel;
  className?: string;
}

/** Announced immediately to screen readers (role="alert"). Never show raw error messages here. */
export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
  retryLabel = "Try again",
  headingLevel = 2,
  className,
}: ErrorStateProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div
      role="alert"
      className={clsx("mx-auto max-w-xl space-y-3 px-6 py-12 text-center", className)}
    >
      <Heading className="text-xl font-semibold">{title}</Heading>
      {description && <p className="text-fg-muted">{description}</p>}
      {onRetry && (
        <div className="pt-2">
          <Button onClick={onRetry}>{retryLabel}</Button>
        </div>
      )}
    </div>
  );
}

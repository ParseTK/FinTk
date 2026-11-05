import clsx from "clsx";
import type { ReactNode } from "react";

export type HeadingLevel = 1 | 2 | 3;

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** A call to action, e.g. a LinkButton. */
  action?: ReactNode;
  /** Decorative icon (aria-hidden). */
  icon?: ReactNode;
  /** Use 1 only when this state replaces the whole page. Default 2. */
  headingLevel?: HeadingLevel;
  className?: string;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  headingLevel = 2,
  className,
}: EmptyStateProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div className={clsx("mx-auto max-w-xl space-y-3 px-6 py-12 text-center", className)}>
      {icon && (
        <div aria-hidden="true" className="text-fg-muted flex justify-center">
          {icon}
        </div>
      )}
      {/* A state that replaces the whole page is the page title, so it looks like one. */}
      <Heading
        className={
          headingLevel === 1 ? "text-3xl font-bold tracking-tight" : "text-xl font-semibold"
        }
      >
        {title}
      </Heading>
      {description && <p className="text-fg-muted">{description}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}

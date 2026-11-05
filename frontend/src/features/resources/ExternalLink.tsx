import type { ReactNode } from "react";

/** A link to another site: opens in a new tab and says so to screen readers. */
export function ExternalLink({
  href,
  className = "text-brand font-medium underline underline-offset-2 hover:no-underline",
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

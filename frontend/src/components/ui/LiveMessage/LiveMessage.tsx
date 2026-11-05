import clsx from "clsx";
import type { ReactNode } from "react";

export interface LiveMessageProps {
  /** `error` interrupts (role=alert); `success` waits its turn (role=status). */
  tone?: "error" | "success";
  /** The message. Empty or absent means nothing is announced and nothing is shown. */
  children?: ReactNode;
  className?: string;
}

/**
 * A short message that a screen reader announces when it appears, under a button or form.
 *
 * The element is always in the page. Announcements work by watching a region whose content
 * changes, and an element that is display:none (`hidden`) is not in the accessibility tree, so text
 * that appears and unhides in the same moment is often not announced. When there is nothing to
 * say the region stays present but visually collapsed (`sr-only`), taking no space.
 */
export function LiveMessage({ tone = "error", children, className }: LiveMessageProps) {
  const hasMessage = Boolean(children);
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={clsx(
        hasMessage ? (tone === "error" ? "text-loss text-sm" : "text-gain text-sm") : "sr-only",
        className,
      )}
    >
      {children}
    </p>
  );
}

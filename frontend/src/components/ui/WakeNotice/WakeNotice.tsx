"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";

export const WAKE_NOTICE_DELAY_MS = 6_000;

/**
 * Explains a long wait on a loading screen. The free host stops the data service when it is idle and
 * takes up to a minute to start it, so a first visit can sit on a skeleton for a long time. Quick
 * loads never reach the delay and never see this. The region is always in the page (so the
 * announcement is made when the text arrives) and takes no space until it has something to say.
 */
export function WakeNotice({
  delayMs = WAKE_NOTICE_DELAY_MS,
  className,
}: {
  delayMs?: number;
  className?: string;
}) {
  const [late, setLate] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setLate(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);

  return (
    <p role="status" className={clsx(late ? "text-fg-muted text-sm" : "sr-only", className)}>
      {late
        ? "This is taking longer than usual. The server was asleep and is starting up, which can take up to a minute."
        : null}
    </p>
  );
}

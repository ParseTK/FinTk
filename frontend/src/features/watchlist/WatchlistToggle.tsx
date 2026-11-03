"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { LiveMessage } from "@/components/ui/LiveMessage";
import { LinkButton } from "@/components/ui/LinkButton";
import { sendJson } from "@/lib/apiRequest";

export interface WatchlistToggleProps {
  symbol: string;
  watched: boolean;
  /** Present when signed in; the toggle sends it with every change. */
  csrfToken?: string;
  /** Where to come back to after signing in. */
  signInNext?: string;
}

/**
 * Add or remove one company. The name never changes ("Watch AAPL") and `aria-pressed` carries the
 * state, so a screen reader announces "Watch AAPL, toggle button, pressed" and not a second label.
 * The page state only changes after the server agrees.
 */
export function WatchlistToggle({
  symbol,
  watched,
  csrfToken,
  signInNext = "/",
}: WatchlistToggleProps) {
  const [isWatched, setIsWatched] = useState(watched);
  // Follow the server: if the page is re-rendered with a different value (after a refresh, or a
  // change made elsewhere), show that instead of the value this component started with.
  const [seenProp, setSeenProp] = useState(watched);
  if (watched !== seenProp) {
    setSeenProp(watched);
    setIsWatched(watched);
  }
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  if (!csrfToken) {
    return (
      <LinkButton
        href={`/sign-in?next=${encodeURIComponent(signInNext)}`}
        variant="secondary"
        size="sm"
      >
        Sign in to watch {symbol}
      </LinkButton>
    );
  }

  async function toggle() {
    setBusy(true);
    setProblem("");
    const path = `/api/v1/watchlist/${encodeURIComponent(symbol)}`;
    const result = await sendJson(isWatched ? "DELETE" : "PUT", path, csrfToken!);
    setBusy(false);
    if (result.ok) setIsWatched(!isWatched);
    else setProblem(result.message);
  }

  return (
    <div className="space-y-1">
      <Button
        variant={isWatched ? "secondary" : "primary"}
        size="sm"
        aria-pressed={isWatched}
        loading={busy}
        onClick={toggle}
      >
        {isWatched && <span aria-hidden="true">&#10003;</span>}
        Watch {symbol}
      </Button>
      <LiveMessage>{problem}</LiveMessage>
    </div>
  );
}

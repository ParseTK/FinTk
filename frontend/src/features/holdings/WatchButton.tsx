"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { LiveMessage } from "@/components/ui/LiveMessage";
import { sendJson } from "@/lib/apiRequest";
import { useMutation } from "@/lib/useMutation";

export interface WatchButtonProps {
  slug: string;
  name: string;
  watched: boolean;
  /** Present when signed in; the button sends it with every change. */
  csrfToken?: string;
  /** Where to come back to after signing in. */
  signInNext: string;
}

/**
 * Watch or stop watching one coin. The name never changes ("Watch Bitcoin") and `aria-pressed`
 * carries the state, so a screen reader says "Watch Bitcoin, toggle button, pressed" and not a
 * second label. The state only changes after the server agrees. Signed out, it is a link to sign in.
 */
export function WatchButton({ slug, name, watched, csrfToken, signInNext }: WatchButtonProps) {
  const router = useRouter();
  const [isWatched, setIsWatched] = useState(watched);
  // Follow the server: a page re-rendered with a different value shows that, not the old one.
  const [seen, setSeen] = useState(watched);
  if (watched !== seen) {
    setSeen(watched);
    setIsWatched(watched);
  }
  const { busy, problem, run } = useMutation();

  if (!csrfToken) {
    return (
      <LinkButton
        href={`/sign-in?next=${encodeURIComponent(signInNext)}`}
        variant="secondary"
        size="sm"
      >
        Sign in to watch {name}
      </LinkButton>
    );
  }

  async function toggle() {
    const result = await run(() =>
      sendJson(
        isWatched ? "DELETE" : "PUT",
        `/api/v1/watchlist/${encodeURIComponent(slug)}`,
        csrfToken!,
      ),
    );
    if (result?.ok) {
      setIsWatched(!isWatched);
      router.refresh();
    }
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
        Watch {name}
      </Button>
      <LiveMessage>{problem}</LiveMessage>
    </div>
  );
}

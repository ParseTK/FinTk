"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LiveMessage } from "@/components/ui/LiveMessage";
import { sendJson } from "@/lib/apiRequest";
import { actionClass } from "./actionStyles";

export interface RemoveButtonProps {
  /** What is removed, for the button's name: "Bitcoin from your portfolio". */
  what: string;
  /** The API path to DELETE. */
  path: string;
  csrfToken: string;
}

/**
 * Removes one saved row, with a second press to confirm (nothing is undoable). It looks like the
 * Edit action beside it; the first press turns it into a "Confirm remove" button, the second
 * removes, and leaving it cancels. It stays one element so keyboard focus is not lost between the
 * presses. The name says what will go, because a row of identical "Remove" buttons tells a
 * screen-reader user nothing, and the change is announced without adding text to the page.
 */
export function RemoveButton({ what, path, csrfToken }: RemoveButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  async function remove() {
    if (busy) return;
    setBusy(true);
    setProblem("");
    const result = await sendJson("DELETE", path, csrfToken);
    setBusy(false);
    setConfirming(false);
    if (result.ok) router.refresh();
    else setProblem(result.message);
  }

  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        aria-busy={busy || undefined}
        className={clsx(
          actionClass,
          confirming &&
            "bg-loss text-on-accent rounded-lg px-3 font-semibold whitespace-nowrap no-underline hover:opacity-90",
        )}
        onClick={() => (confirming ? remove() : setConfirming(true))}
        onBlur={() => setConfirming(false)}
      >
        {confirming ? "Confirm remove" : "Remove"} <span className="sr-only">{what}</span>
      </button>
      <span className="sr-only" role="status">
        {confirming ? `Press again to remove ${what}.` : ""}
      </span>
      <LiveMessage>{problem}</LiveMessage>
    </span>
  );
}

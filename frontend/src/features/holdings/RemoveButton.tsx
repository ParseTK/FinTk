"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { LiveMessage } from "@/components/ui/LiveMessage";
import { sendJson } from "@/lib/apiRequest";

export interface RemoveButtonProps {
  /** What is removed, for the button's name: "Bitcoin from your portfolio". */
  what: string;
  /** The API path to DELETE. */
  path: string;
  csrfToken: string;
}

/**
 * Removes one saved row, with a second press to confirm (nothing is undoable). The first press
 * asks, the second removes; leaving the button cancels. The name says what will go, because a row of
 * identical "Remove" buttons tells a screen-reader user nothing.
 */
export function RemoveButton({ what, path, csrfToken }: RemoveButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  async function remove() {
    setBusy(true);
    setProblem("");
    const result = await sendJson("DELETE", path, csrfToken);
    setBusy(false);
    setConfirming(false);
    if (result.ok) router.refresh();
    else setProblem(result.message);
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        variant={confirming ? "danger" : "ghost"}
        size="sm"
        loading={busy}
        onClick={() => (confirming ? remove() : setConfirming(true))}
        onBlur={() => setConfirming(false)}
      >
        {confirming ? "Confirm remove" : "Remove"} <span className="sr-only">{what}</span>
      </Button>
      <LiveMessage tone="success">{confirming ? `Press again to remove ${what}.` : ""}</LiveMessage>
      <LiveMessage>{problem}</LiveMessage>
    </span>
  );
}

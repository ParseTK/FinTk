"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { LiveMessage } from "@/components/ui/LiveMessage";
import { sendJson } from "@/lib/apiRequest";

export function RemoveFromWatchlist({ symbol, csrfToken }: { symbol: string; csrfToken: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  async function remove() {
    setBusy(true);
    setProblem("");
    const result = await sendJson(
      "DELETE",
      `/api/v1/watchlist/${encodeURIComponent(symbol)}`,
      csrfToken,
    );
    if (result.ok) {
      router.refresh(); // the server renders the list; ask it for the new one
      return;
    }
    setBusy(false);
    setProblem(result.message);
  }

  return (
    <div className="space-y-1">
      <Button variant="secondary" size="sm" loading={busy} onClick={remove}>
        Remove <span className="sr-only">{symbol} from watchlist</span>
      </Button>
      <LiveMessage>{problem}</LiveMessage>
    </div>
  );
}

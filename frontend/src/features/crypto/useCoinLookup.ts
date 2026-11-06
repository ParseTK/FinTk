"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { findCoins, type CoinSuggestion } from "./actions";

const DEBOUNCE_MS = 150;

export type LookupStatus = "idle" | "loading" | "done";

/**
 * Looks coins up as the visitor types: waits a moment after the last keystroke, asks the server,
 * and keeps only the answer to the newest text (answers that arrive out of order are dropped).
 * A failed lookup reads as "no matches"; the search page is still one Enter away.
 * `onResults` runs when a fresh answer replaces the list, so the caller can reset its highlight.
 */
export function useCoinLookup(text: string, onResults?: () => void) {
  const [suggestions, setSuggestions] = useState<CoinSuggestion[]>([]);
  const [status, setStatus] = useState<LookupStatus>("idle");
  const latest = useRef(0);
  const notify = useRef(onResults);
  useEffect(() => {
    notify.current = onResults;
  });

  useEffect(() => {
    const query = text.trim();
    const ticket = ++latest.current;
    if (query === "") return;
    const timer = setTimeout(async () => {
      setStatus("loading");
      let found: CoinSuggestion[] = [];
      try {
        found = await findCoins(query);
      } catch {
        // shown as "no matches"
      }
      if (ticket !== latest.current) return; // a newer keystroke owns the list now
      setSuggestions(found);
      notify.current?.();
      setStatus("done");
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  /** Forget the current list (the box was emptied or a coin was chosen). */
  const clear = useCallback(() => {
    setSuggestions([]);
    setStatus("idle");
  }, []);

  return { suggestions, status, clear };
}

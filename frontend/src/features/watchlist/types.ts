import type { components } from "@/lib/api/schema";

export type WatchlistItem = components["schemas"]["WatchlistItemResponse"];

/** What a page needs to render watchlist toggles for the current visitor. */
export type WatchlistState =
  { signedIn: false } | { signedIn: true; csrfToken: string; symbols: readonly string[] };

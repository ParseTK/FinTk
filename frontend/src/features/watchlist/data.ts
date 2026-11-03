import "server-only";
import { getSession } from "@/features/auth";
import { authHeaders } from "@/lib/api/authHeaders";
import { privateApi } from "@/lib/api/client";
import type { WatchlistItem, WatchlistState } from "./types";

/** The visitor's watchlist, or null if it could not be read (so pages can say so, not crash). */
export async function getWatchlist(): Promise<WatchlistItem[] | null> {
  try {
    const { data } = await privateApi.GET("/api/v1/watchlist", { headers: await authHeaders() });
    return data?.items ?? null;
  } catch {
    return null;
  }
}

/**
 * Everything a page needs to render watchlist toggles: whether the visitor is signed in, their
 * CSRF token, and which symbols they already watch. Fails soft: if the list cannot be read the
 * toggles still work (adding something already there is a harmless repeat), they just start unset.
 */
export async function getWatchlistState(): Promise<WatchlistState> {
  const { user, csrfToken } = await getSession();
  if (!user || !csrfToken) return { signedIn: false };
  const items = await getWatchlist();
  return { signedIn: true, csrfToken, symbols: (items ?? []).map((item) => item.symbol) };
}

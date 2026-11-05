import "server-only";
import { authHeaders } from "@/lib/api/authHeaders";
import { privateApi as api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

export type Portfolio = components["schemas"]["PortfolioResponse"];
export type HoldingValue = components["schemas"]["HoldingValueResponse"];
export type Watchlist = components["schemas"]["WatchlistResponse"];
export type WatchlistItem = components["schemas"]["WatchlistItemResponse"];

/**
 * What a read can come back as. "signed-out" is told apart from "unavailable" so a page can send
 * a visitor to sign in, and show a plain message (not a sign-in prompt) when the API is down.
 */
export type Loaded<T> =
  { status: "ok"; data: T } | { status: "signed-out" } | { status: "unavailable" };

async function load<T>(
  call: (headers: Record<string, string>) => Promise<{ data?: T; response: Response }>,
): Promise<Loaded<T>> {
  try {
    const { data, response } = await call(await authHeaders());
    if (data) return { status: "ok", data };
    return { status: response.status === 401 ? "signed-out" : "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}

/** The signed-in person's holdings, valued at today's prices. Never cached: it is theirs alone. */
export const getPortfolio = () => load((headers) => api.GET("/api/v1/portfolio", { headers }));

/** The signed-in person's watched coins, with today's prices. */
export const getWatchlist = () => load((headers) => api.GET("/api/v1/watchlist", { headers }));

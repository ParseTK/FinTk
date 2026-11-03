import "server-only";
// Uncached on purpose: the API already caches the overview (briefly while rows are missing), and a
// second 5-minute cache here would keep a half-filled page half-filled after a reload.
import { privateApi as api } from "@/lib/api/client";
import type { MarketOverview } from "./types";

/**
 * The market overview, or null if it cannot be had right now. The page shows a plain message
 * instead of an error screen. Rows the API has no figures for yet come back without them.
 */
export async function getMarketOverview(): Promise<MarketOverview | null> {
  try {
    const { data } = await api.GET("/api/v1/markets/overview");
    return data ?? null;
  } catch {
    return null;
  }
}

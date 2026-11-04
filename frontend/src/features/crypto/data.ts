import "server-only";
// Never cached by Next: the API already caches for a few minutes, and the vendor allows only
// temporary storage of its data, so a second cache here would only keep prices around longer.
import { privateApi as api } from "@/lib/api/client";
import type { CryptoMarkets, CryptoOverview } from "./types";

/**
 * The crypto overview, or null if it cannot be had right now (not configured, over budget, or the
 * provider is down). The page shows a plain message instead of an error screen.
 */
export async function getCryptoOverview(): Promise<CryptoOverview | null> {
  try {
    const { data } = await api.GET("/api/v1/crypto/overview");
    return data ?? null;
  } catch {
    return null;
  }
}

/** The market make-up and the largest coins' changes, or null if they cannot be had right now. */
export async function getCryptoMarkets(): Promise<CryptoMarkets | null> {
  try {
    const { data } = await api.GET("/api/v1/crypto/markets");
    return data ?? null;
  } catch {
    return null;
  }
}

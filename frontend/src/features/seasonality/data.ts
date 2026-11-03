import "server-only";
import { publicApi as api } from "@/lib/api/client";
import type { Seasonality } from "./types";

const TICKER_PATTERN = /^[A-Za-z]{1,6}([.-][A-Za-z]{1,2})?$/;

/**
 * Month-by-year returns for a company, or null if they cannot be had right now. Prices are a
 * supporting section of the company page, so a failure must leave the rest of the page working
 * instead of replacing it with an error screen.
 */
export async function getSeasonality(ticker: string): Promise<Seasonality | null> {
  if (!TICKER_PATTERN.test(ticker)) return null;
  try {
    const { data } = await api.GET("/api/v1/companies/{ticker}/seasonality", {
      params: { path: { ticker } },
    });
    return data ?? null;
  } catch {
    return null;
  }
}

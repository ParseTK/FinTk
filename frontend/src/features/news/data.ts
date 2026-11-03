import "server-only";
import { publicApi as api } from "@/lib/api/client";
import { isValidTicker } from "@/lib/ticker";
import type { CompanyNews, MarketNews } from "./types";

/** Market-wide official announcements, or null if they cannot be had right now. */
export async function getMarketNews(limit = 20): Promise<MarketNews | null> {
  try {
    const { data } = await api.GET("/api/v1/news", { params: { query: { limit } } });
    return data ?? null;
  } catch {
    return null;
  }
}

/** A company's recent SEC 8-K events, or null. A supporting section must never break its page. */
export async function getCompanyNews(ticker: string, limit = 8): Promise<CompanyNews | null> {
  if (!isValidTicker(ticker)) return null;
  try {
    const { data } = await api.GET("/api/v1/companies/{ticker}/news", {
      params: { path: { ticker }, query: { limit } },
    });
    return data ?? null;
  } catch {
    return null;
  }
}

import "server-only";
import type { CompanyProfile, CompanySearchResult } from "./types";

const BASE_URL = "https://financialmodelingprep.com/stable";
const ONE_HOUR = 60 * 60;
const TICKER_PATTERN = /^[A-Za-z0-9.\-^]{1,12}$/;

export class UpstreamError extends Error {}

export const isValidTicker = (value: string) => TICKER_PATTERN.test(value);

async function fmpGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) throw new UpstreamError("FMP_API_KEY is not configured");

  const url = new URL(`${BASE_URL}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  // Key goes in a header, not the URL, so it never ends up in logs or error messages.
  const response = await fetch(url, {
    headers: { apikey: apiKey },
    next: { revalidate: ONE_HOUR },
  });
  if (!response.ok) throw new UpstreamError(`Market data request failed (${response.status})`);
  return (await response.json()) as T;
}

export async function searchCompanies(query: string): Promise<CompanySearchResult[]> {
  const trimmed = query.trim().slice(0, 64);
  if (!trimmed) return [];
  return fmpGet<CompanySearchResult[]>("search-name", { query: trimmed, limit: "20" });
}

export async function getCompanyProfile(ticker: string): Promise<CompanyProfile | null> {
  if (!isValidTicker(ticker)) return null;
  const profiles = await fmpGet<CompanyProfile[]>("profile", { symbol: ticker.toUpperCase() });
  return profiles[0] ?? null;
}

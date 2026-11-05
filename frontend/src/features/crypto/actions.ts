"use server";

import { searchCoins } from "./data";

export interface CoinSuggestion {
  name: string;
  symbol: string;
  slug: string;
}

const MAX_QUERY = 40;
const SUGGESTIONS = 8;

/**
 * Suggestions for the header search box. A Server Action is a POST anyone can send, so it checks
 * its own input and returns only what a suggestion list needs (a name, a symbol and the address
 * part): nothing the data provider's licence would treat as a feed, and no figures.
 */
export async function findCoins(query: unknown): Promise<CoinSuggestion[]> {
  if (typeof query !== "string") return [];
  const text = query.trim().slice(0, MAX_QUERY);
  if (text === "") return [];
  const found = await searchCoins(text, SUGGESTIONS);
  return (found?.results ?? []).map(({ name, symbol, slug }) => ({ name, symbol, slug }));
}

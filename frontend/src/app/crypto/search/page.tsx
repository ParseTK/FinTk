import type { Metadata } from "next";
import { SearchResults } from "@/features/crypto";

export const metadata: Metadata = {
  title: "Search coins",
  description: "Find a coin by name or symbol among the largest cryptocurrencies.",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q } = await searchParams;
  return <SearchResults query={Array.isArray(q) ? q[0] : q} />;
}

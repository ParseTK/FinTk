import type { Metadata } from "next";
import { WatchlistPage } from "@/features/holdings";

export const metadata: Metadata = { title: "Watchlist", robots: { index: false } };

export default function WatchlistRoute() {
  return <WatchlistPage />;
}

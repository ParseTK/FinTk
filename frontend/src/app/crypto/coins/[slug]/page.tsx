import type { Metadata } from "next";
import { CoinPage } from "@/features/crypto";
import { CoinHoldingsPanel } from "@/features/holdings";
import { isEnabled } from "@/lib/flags";

export const metadata: Metadata = {
  title: "Coin",
  description:
    "A coin's price, how it has changed over each period, and its market value and supply.",
};

export default async function CoinRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // The holdings panel needs sign-in and the holdings pages; without them the page is just the coin.
  const holdings = isEnabled("holdings") && isEnabled("auth");
  return (
    <CoinPage
      slug={slug}
      extras={holdings ? (coin) => <CoinHoldingsPanel {...coin} /> : undefined}
    />
  );
}

import type { Metadata } from "next";
import { CoinPage } from "@/features/crypto";

export const metadata: Metadata = {
  title: "Coin",
  description:
    "A coin's price, how it has changed over each period, and its market value and supply.",
};

export default async function CoinRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CoinPage slug={slug} />;
}

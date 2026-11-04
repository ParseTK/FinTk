import type { Metadata } from "next";
import { CryptoPageBody } from "@/features/crypto";

export const metadata: Metadata = {
  title: "Crypto",
  description: "The largest cryptocurrencies by market cap, with market totals and Fear and Greed.",
};

export default function CryptoPage() {
  return <CryptoPageBody title="Crypto" intro="The largest coins and how the market is feeling." />;
}

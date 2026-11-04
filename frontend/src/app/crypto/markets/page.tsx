import type { Metadata } from "next";
import { CryptoMarketsPageBody } from "@/features/crypto";

export const metadata: Metadata = {
  title: "Crypto markets",
  description:
    "How the crypto market is made up, and how the ten largest coins have done over 30 days to a year.",
};

export default function CryptoMarketsPage() {
  return (
    <CryptoMarketsPageBody
      title="Crypto markets"
      intro="How the market is made up, and how the largest coins have done."
    />
  );
}

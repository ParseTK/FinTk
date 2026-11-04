import type { Metadata } from "next";
import { CryptoNewsPageBody } from "@/features/crypto";

export const metadata: Metadata = {
  title: "Crypto news",
  description:
    "Official SEC, CFTC and Department of Justice announcements about crypto, and SEC filings of listed crypto companies. No opinions.",
};

export default function CryptoNewsPage() {
  return (
    <CryptoNewsPageBody
      title="Crypto news"
      intro="What the official sources have announced about crypto, as published."
    />
  );
}

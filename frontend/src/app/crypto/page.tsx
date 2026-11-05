import type { Metadata } from "next";
import { CryptoPageBody } from "@/features/crypto";

export const metadata: Metadata = {
  title: "Crypto",
  description: "Crypto market mood, the Fear and Greed index, and what this section covers.",
};

export default function CryptoPage() {
  return (
    <CryptoPageBody
      title="Crypto"
      intro="How the crypto market is feeling, and what this section covers."
    />
  );
}

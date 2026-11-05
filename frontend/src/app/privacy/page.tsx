import type { Metadata } from "next";
import { PrivacyPolicy } from "@/features/legal";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What Virello stores about you, why, and how to delete it.",
};

export default function Page() {
  return <PrivacyPolicy />;
}

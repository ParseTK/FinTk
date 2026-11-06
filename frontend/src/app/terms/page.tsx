import type { Metadata } from "next";
import { TermsOfUse } from "@/features/legal";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "The terms for using FinTk: personal use, not investment advice, no guarantees.",
};

export default function Page() {
  return <TermsOfUse />;
}

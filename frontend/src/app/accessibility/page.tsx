import type { Metadata } from "next";
import { AccessibilityStatement } from "@/features/legal";

export const metadata: Metadata = {
  title: "Accessibility statement",
  description: "What FinTk aims for, what is built in, and its known accessibility limits.",
};

export default function Page() {
  return <AccessibilityStatement />;
}

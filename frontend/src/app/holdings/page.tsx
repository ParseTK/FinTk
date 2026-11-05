import type { Metadata } from "next";
import { PortfolioPage } from "@/features/holdings";

export const metadata: Metadata = { title: "Portfolio", robots: { index: false } };

export default function HoldingsRoute() {
  return <PortfolioPage />;
}

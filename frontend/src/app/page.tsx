import { Hero } from "@/components/Hero";
import { FeatureGrid } from "@/components/home/FeatureGrid";
import { MarketTicker } from "@/components/home/MarketTicker";

export default function HomePage() {
  return (
    <>
      <Hero />
      <MarketTicker />
      <FeatureGrid />
    </>
  );
}

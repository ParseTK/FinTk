import { Feature } from "@/components/Feature";
import { Hero } from "@/components/Hero";
import { FeatureGrid } from "@/components/home/FeatureGrid";
import { MarketTicker } from "@/components/home/MarketTicker";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Feature flag="market_ticker">
        <MarketTicker />
      </Feature>
      <FeatureGrid />
    </>
  );
}

import { Feature } from "@/components/ui/Feature";
import { Hero } from "@/features/home";
import { FeatureGrid } from "@/features/home";
import { MarketTicker } from "@/features/home";

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

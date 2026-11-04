import { Feature } from "@/components/ui/Feature";
import { FeatureGrid, Hero, MarketTicker } from "@/features/home";

export default function HomePage() {
  // The landing page is the same in both modes; the Crypto | Stocks switch only changes the links.
  return (
    <>
      {/* The market strip sits right under the navigation, like a finance site's ticker bar. */}
      <Feature flag="market_ticker">
        <MarketTicker />
      </Feature>
      <Hero />
      <FeatureGrid />
    </>
  );
}

import { Feature } from "@/components/ui/Feature";
import { CryptoHome, FeatureGrid, Hero, MarketTicker } from "@/features/home";
import { isEnabled } from "@/lib/flags";

export default function HomePage() {
  // The landing page is the same in both modes; the Crypto | Stocks switch only changes the links.
  // With crypto_home on it leads with crypto: live prices, a Bitcoin chart, no company search.
  if (isEnabled("crypto_home") && isEnabled("crypto")) return <CryptoHome />;

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

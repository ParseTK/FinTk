import { Feature } from "@/components/ui/Feature";
import { CryptoPageBody } from "@/features/crypto";
import { FeatureGrid, Hero, MarketTicker } from "@/features/home";
import { getMode } from "@/features/shell";

export default async function HomePage() {
  // In Crypto mode (only while the Crypto | Stocks switch is on) the home page is the crypto
  // overview, since crypto is what a first-time visitor is here for. Otherwise it is the usual
  // company-research landing page.
  if ((await getMode()) === "crypto") {
    return (
      <CryptoPageBody
        title="Crypto data without the hype."
        intro="Prices, market totals and sentiment, shown as published. Switch to Stocks for company research from SEC filings."
      />
    );
  }

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

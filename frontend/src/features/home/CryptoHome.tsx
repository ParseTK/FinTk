import { BitcoinChart, CryptoTicker, getCryptoMarkets } from "@/features/crypto";
import { LinkButton } from "@/components/ui/LinkButton";
import { isEnabled } from "@/lib/flags";
import { Hero } from "./Hero";

/**
 * The landing page when it leads with crypto: a strip of live prices, then the hero with a plain
 * Bitcoin chart. Both come from one request for the market figures; if that fails they are simply
 * left out (the hero is then centered), never replaced with invented numbers.
 */
export async function CryptoHome() {
  const markets = await getCryptoMarkets();
  const chart = BitcoinChart({ markets });

  return (
    <>
      <CryptoTicker markets={markets} />
      <Hero
        copy={{
          headline: (
            <>
              Digital{" "}
              <span className="from-brand bg-gradient-to-r to-[color-mix(in_oklab,var(--brand),var(--fg)_40%)] bg-clip-text text-transparent">
                financial
              </span>{" "}
              data.
            </>
          ),
          body: "Research crypto markets, coins and official filings.",
          actions: (
            <>
              <LinkButton href="/crypto" size="lg">
                Explore the market
              </LinkButton>
              {isEnabled("crypto_news") && (
                <LinkButton href="/crypto/news" size="lg" variant="secondary">
                  Read the news
                </LinkButton>
              )}
            </>
          ),
        }}
        chart={chart}
      />
    </>
  );
}

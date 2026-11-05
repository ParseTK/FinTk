import { BitcoinChart, CryptoTicker, getCryptoMarkets } from "@/features/crypto";
import { LinkButton } from "@/components/ui/LinkButton";
import { isEnabled } from "@/lib/flags";
import { Hero } from "./Hero";

/**
 * The landing page: a strip of live prices, then the hero with a plain Bitcoin chart. Both come from
 * one request for the market figures; if that fails (or the crypto pages are off) they are simply
 * left out and the hero is centered, never replaced with invented numbers.
 */
export async function CryptoHome() {
  const crypto = isEnabled("crypto");
  const markets = crypto ? await getCryptoMarkets() : null;
  const chart = BitcoinChart({ markets });

  return (
    <>
      <CryptoTicker markets={markets} />
      <Hero
        headline={
          <>
            Digital{" "}
            <span className="from-brand bg-gradient-to-r to-[color-mix(in_oklab,var(--brand),var(--fg)_40%)] bg-clip-text text-transparent">
              financial
            </span>{" "}
            data.
          </>
        }
        body="Research crypto markets, coins and official filings."
        actions={
          crypto && (
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
          )
        }
        chart={chart}
      />
    </>
  );
}

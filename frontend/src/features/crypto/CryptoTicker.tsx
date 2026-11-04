import { DataCredit } from "@/components/ui/DataCredit";
import { Ticker } from "@/components/ui/Ticker";
import { formatCoinPrice } from "./crypto";
import type { CryptoMarkets } from "./types";

/**
 * A strip of live quotes for the ten largest coins, with the data provider's credit where the
 * licence wants it. Shows nothing (never invented numbers) when the figures cannot be had.
 */
export function CryptoTicker({ markets }: { markets: CryptoMarkets | null }) {
  if (!markets || markets.majors.length === 0) return null;
  return (
    <Ticker
      label="Live prices of the ten largest cryptocurrencies"
      lead={
        <DataCredit
          text={markets.attribution.text}
          href={markets.attribution.url}
          linkText="CoinMarketCap.com"
        />
      }
      items={markets.majors.map((coin) => ({
        symbol: coin.symbol,
        price: formatCoinPrice(coin.price),
        change: coin.change_24h,
      }))}
      pauseLabel="Pause prices"
      playLabel="Play prices"
    />
  );
}

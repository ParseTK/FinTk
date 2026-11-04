import { CryptoMarkets } from "./CryptoMarkets";
import { CryptoPageShell } from "./CryptoPageShell";

/** The /crypto/markets page: a heading, then the markets body, which streams in. */
export function CryptoMarketsPageBody({ title, intro }: { title: string; intro: string }) {
  return (
    <CryptoPageShell title={title} intro={intro} loadingLabel="Loading crypto markets">
      <CryptoMarkets />
    </CryptoPageShell>
  );
}

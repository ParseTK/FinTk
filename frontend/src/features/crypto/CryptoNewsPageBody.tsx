import { CryptoNews } from "./CryptoNews";
import { CryptoPageShell } from "./CryptoPageShell";

/** The /crypto/news page: a heading, then the news body, which streams in. */
export function CryptoNewsPageBody({ title, intro }: { title: string; intro: string }) {
  return (
    <CryptoPageShell title={title} intro={intro} loadingLabel="Loading crypto news">
      <CryptoNews />
    </CryptoPageShell>
  );
}

import { CryptoOverview } from "./CryptoOverview";
import { CryptoPageShell } from "./CryptoPageShell";

/**
 * The crypto page: a heading, then the overview. Shared by the /crypto page and the home page in
 * Crypto mode so the two cannot drift apart.
 */
export function CryptoPageBody({ title, intro }: { title: string; intro: string }) {
  return (
    <CryptoPageShell title={title} intro={intro} loadingLabel="Loading crypto prices">
      <CryptoOverview />
    </CryptoPageShell>
  );
}

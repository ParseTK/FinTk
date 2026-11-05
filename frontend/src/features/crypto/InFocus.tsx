import { Card } from "@/components/ui/Card";
import { Change } from "@/components/ui/Change";
import type { CryptoAsset } from "./types";

export interface Movers {
  gain: CryptoAsset;
  decline: CryptoAsset;
  advancing: number;
  declining: number;
}

/**
 * The biggest riser and faller over 24 hours among the coins given, and how many rose and fell.
 * Coins with no 24 hour change are left out of all of it. Returns null with fewer than two coins
 * that have a change, because then there is nothing to compare.
 */
export function movers(assets: readonly CryptoAsset[]): Movers | null {
  const known = assets
    .filter((asset) => asset.change_24h !== null && asset.change_24h.trim() !== "")
    .map((asset) => ({ asset, change: Number(asset.change_24h) }))
    .filter(({ change }) => Number.isFinite(change));
  if (known.length < 2) return null;
  const byChange = [...known].sort((a, b) => b.change - a.change);
  return {
    gain: byChange[0]!.asset,
    decline: byChange[byChange.length - 1]!.asset,
    advancing: known.filter(({ change }) => change > 0).length,
    declining: known.filter(({ change }) => change < 0).length,
  };
}

function Mover({ label, asset }: { label: string; asset: CryptoAsset }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-fg-muted text-xs font-semibold tracking-wide uppercase">{label}</p>
        <p className="mt-1 font-semibold">
          {asset.name} <span className="text-fg-muted text-sm font-normal">{asset.symbol}</span>
        </p>
      </div>
      <Change value={asset.change_24h} className="text-lg" />
    </div>
  );
}

/**
 * "In focus": the day's largest gain and decline and an advancing / declining bar. The bar is a
 * picture of the two counts written beside it. Stablecoins are in the pool, so a quiet day shows
 * small moves honestly rather than hiding them.
 */
export function InFocus({ assets }: { assets: readonly CryptoAsset[] }) {
  const result = movers(assets);
  if (!result) return null;
  const { gain, decline, advancing, declining } = result;
  const total = advancing + declining;

  return (
    <Card as="section" aria-labelledby="in-focus-heading" className="space-y-4 rounded-2xl">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="in-focus-heading" className="text-xl font-semibold">
          In focus
        </h2>
        <p className="text-fg-muted text-xs">Past 24 hours, {assets.length} largest coins</p>
      </div>
      <Mover label="Largest gain" asset={gain} />
      <hr className="border-border" />
      <Mover label="Largest decline" asset={decline} />
      {total > 0 && (
        <div className="space-y-2">
          <div
            aria-hidden="true"
            className="bg-border flex h-2 w-full gap-0.5 overflow-clip rounded-full"
          >
            <span className="bg-gain" style={{ width: `${(advancing / total) * 100}%` }} />
            <span className="bg-loss" style={{ width: `${(declining / total) * 100}%` }} />
          </div>
          <p className="text-fg-muted text-sm">
            {advancing} advancing <span aria-hidden="true">/</span>
            <span className="sr-only">,</span> {declining} declining
          </p>
        </div>
      )}
    </Card>
  );
}

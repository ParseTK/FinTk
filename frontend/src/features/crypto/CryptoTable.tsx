import { Card } from "@/components/ui/Card";
import { Change } from "@/components/ui/Change";
import { compactUsd, formatCoinPrice } from "./crypto";
import type { CryptoAsset } from "./types";

const NOT_AVAILABLE = <span className="text-fg-muted whitespace-nowrap">Not available</span>;

function Name({ asset }: { asset: CryptoAsset }) {
  return (
    <>
      <span className="font-medium">{asset.name}</span>{" "}
      <span className="text-fg-muted text-sm">{asset.symbol}</span>
    </>
  );
}

const Percent = ({ value }: { value: string | null }) =>
  value === null ? NOT_AVAILABLE : <Change value={value} />;

const Usd = ({ value }: { value: string | null }) => {
  const text = compactUsd(value);
  return text === null ? NOT_AVAILABLE : <span className="tabular-nums">{text}</span>;
};

const HEADINGS = ["Price", "24 hours", "7 days", "Market cap", "Volume (24 hours)"] as const;

/**
 * The coins as a real table on wide screens, and one labelled card per coin below that (two columns
 * on tablets), so nothing needs sideways scrolling. Seven columns need more room than the Markets
 * table, so the switch is at the large breakpoint. A figure the provider did not supply says so instead of showing zero.
 */
export function CryptoTable({
  caption,
  assets,
}: {
  caption: string;
  assets: readonly CryptoAsset[];
}) {
  return (
    <>
      <Card className="hidden rounded-2xl p-2 sm:p-4 lg:block">
        <table className="w-full text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="text-fg-muted text-sm">
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Rank
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Name
              </th>
              {HEADINGS.map((heading) => (
                <th key={heading} scope="col" className="px-3 py-2 text-right font-medium">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => (
              <tr key={asset.slug} className="border-border border-t">
                <td className="text-fg-muted px-3 py-3 text-right tabular-nums">{asset.rank}</td>
                <th scope="row" className="px-3 py-3 text-left font-normal">
                  <Name asset={asset} />
                </th>
                <td className="px-3 py-3 text-right tabular-nums">
                  {formatCoinPrice(asset.price)}
                </td>
                <td className="px-3 py-3 text-right">
                  <Percent value={asset.change_24h} />
                </td>
                <td className="px-3 py-3 text-right">
                  <Percent value={asset.change_7d} />
                </td>
                <td className="px-3 py-3 text-right">
                  <Usd value={asset.market_cap} />
                </td>
                <td className="px-3 py-3 text-right">
                  <Usd value={asset.volume_24h} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <ul aria-label={caption} className="grid gap-3 md:grid-cols-2 lg:hidden">
        {assets.map((asset) => (
          <li key={asset.slug}>
            <Card as="article" className="space-y-3 rounded-2xl">
              <h3>
                <span className="text-fg-muted mr-2 text-sm tabular-nums">
                  <span className="sr-only">Rank </span>
                  {asset.rank}
                </span>
                <Name asset={asset} />
              </h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-fg-muted">Price</dt>
                  <dd className="mt-0.5 text-base tabular-nums">{formatCoinPrice(asset.price)}</dd>
                </div>
                <div>
                  <dt className="text-fg-muted">24 hours</dt>
                  <dd className="mt-0.5 text-base">
                    <Percent value={asset.change_24h} />
                  </dd>
                </div>
                <div>
                  <dt className="text-fg-muted">7 days</dt>
                  <dd className="mt-0.5 text-base">
                    <Percent value={asset.change_7d} />
                  </dd>
                </div>
                <div>
                  <dt className="text-fg-muted">Market cap</dt>
                  <dd className="mt-0.5 text-base">
                    <Usd value={asset.market_cap} />
                  </dd>
                </div>
                <div>
                  <dt className="text-fg-muted">Volume (24 hours)</dt>
                  <dd className="mt-0.5 text-base">
                    <Usd value={asset.volume_24h} />
                  </dd>
                </div>
              </dl>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}

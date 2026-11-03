import Link from "next/link";
import { formatDate } from "@/lib/format";
import { RemoveFromWatchlist } from "./RemoveFromWatchlist";
import type { WatchlistItem } from "./types";

export function WatchlistTable({
  items,
  csrfToken,
}: {
  items: WatchlistItem[];
  csrfToken: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <caption className="sr-only">Companies on your watchlist, in alphabetical order</caption>
        <thead>
          <tr className="border-border border-b text-sm">
            <th scope="col" className="py-2 pr-4 font-semibold">
              Company
            </th>
            <th scope="col" className="px-2 py-2 font-semibold">
              Added
            </th>
            <th scope="col" className="py-2 pl-2 text-right font-semibold">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.symbol} className="border-border border-b last:border-0">
              <th scope="row" className="py-3 pr-4 font-normal">
                <Link
                  href={`/company/${encodeURIComponent(item.symbol)}`}
                  className="font-semibold underline-offset-2 hover:underline"
                >
                  {item.symbol}
                </Link>
                {item.name && <span className="text-fg-muted block text-sm">{item.name}</span>}
              </th>
              <td className="text-fg-muted px-2 py-3 text-sm">{formatDate(item.added_at)}</td>
              <td className="py-3 pl-2 text-right">
                <RemoveFromWatchlist symbol={item.symbol} csrfToken={csrfToken} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

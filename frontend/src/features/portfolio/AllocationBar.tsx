import Link from "next/link";
import { formatMoney, formatPercent } from "@/lib/format";
import type { Allocation } from "./allocation";

/**
 * How the portfolio is split across companies: one thin, rounded bar, and under it the list that
 * carries the same information in text (company, share, amount) with a swatch for each slice.
 *
 * The bar is a picture of the list, so it is hidden from assistive technology; the list is the
 * accessible version, and color is never the only way to tell slices apart. Parts are separated by
 * a 2px gap of the card's own color rather than by borders.
 */
export function AllocationBar({ allocation }: { allocation: Allocation }) {
  const caption = allocation.basis === "value" ? "current value" : "amount paid";

  return (
    <section aria-labelledby="allocation-heading" className="space-y-3">
      <h3 id="allocation-heading" className="text-sm font-semibold">
        Allocation by {caption}
      </h3>
      <div
        aria-hidden="true"
        className="motion-safe:animate-grow-x flex h-2 w-full origin-left gap-0.5 overflow-clip rounded-full"
      >
        {allocation.slices.map((slice) => (
          <span
            key={slice.key}
            className="block h-full min-w-1"
            // Proportional to the share; flex (not width) so the gaps are accounted for.
            style={{ flex: `${slice.share} 1 0`, background: slice.color }}
          />
        ))}
      </div>
      <ul className="grid gap-x-10 gap-y-2 text-sm sm:grid-cols-2">
        {allocation.slices.map((slice) => (
          <li key={slice.key} className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: slice.color }}
            />
            <span className="min-w-14 flex-1 truncate font-medium">
              {slice.symbol ? (
                <Link
                  href={`/company/${encodeURIComponent(slice.symbol)}`}
                  className="underline-offset-2 hover:underline"
                >
                  {slice.label}
                </Link>
              ) : (
                slice.label
              )}
            </span>
            <span className="tabular-nums">{formatPercent(slice.share * 100, { digits: 1 })}</span>
            <span className="text-fg-muted w-24 text-right tabular-nums">
              {formatMoney(slice.amount)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

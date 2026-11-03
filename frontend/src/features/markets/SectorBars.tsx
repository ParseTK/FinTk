import { Change } from "@/components/ui/Change";
import { isNegative } from "@/lib/format";
import { largestMove, rankByYearToDate } from "./markets";
import type { MarketRow } from "./types";

/**
 * Year to date for each sector, best to worst, as bars growing from a centre line (right for a
 * gain, left for a loss). The bars are a picture of the numbers beside them, so they are hidden
 * from assistive technology; the list carries the figures, with a sign and an arrow, never colour
 * alone.
 */
export function SectorBars({ rows }: { rows: readonly MarketRow[] }) {
  const ranked = rankByYearToDate(rows).filter((row) => row.figures?.year_to_date != null);
  const scale = largestMove(ranked);
  if (ranked.length === 0) return null;

  return (
    <ol aria-label="Sectors by year to date, best first" className="space-y-2">
      {ranked.map((row) => {
        const value = row.figures?.year_to_date ?? "0";
        const share = scale === 0 ? 0 : (Math.abs(Number(value)) / scale) * 50;
        const loss = isNegative(value);
        return (
          <li
            key={row.symbol}
            className="grid grid-cols-[1fr_5.5rem] items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(7rem,1fr)_2fr_5.5rem]"
          >
            <span className="col-span-2 truncate text-sm sm:col-span-1">{row.name}</span>
            <span aria-hidden="true" className="bg-border relative h-2.5 rounded-full">
              <span className="bg-border-strong absolute inset-y-0 left-1/2 w-px" />
              <span
                className={`motion-safe:animate-grow-x absolute inset-y-0 rounded-full ${
                  loss ? "bg-loss right-1/2 origin-right" : "bg-gain left-1/2 origin-left"
                }`}
                style={{ width: `${share}%` }}
              />
            </span>
            <span className="text-right text-sm">
              <Change value={value} />
            </span>
          </li>
        );
      })}
    </ol>
  );
}

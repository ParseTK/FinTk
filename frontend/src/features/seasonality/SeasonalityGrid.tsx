import { VisuallyHidden } from "@/components/ui/VisuallyHidden";
import { formatPercent, PLACEHOLDER } from "@/lib/format";
import type { Seasonality } from "./types";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** A return of this many percent points (up or down) gets the strongest tint. */
const FULL_TINT_AT = 10;
/** The strongest tint, as a share of the cell. Kept low so the number always stays readable. */
const MAX_TINT_PERCENT = 28;

/**
 * A background tint that grows with the size of the move. Color only reinforces: every cell also
 * shows its sign and number. The tint mixes the theme's gain/loss token into transparent, so it
 * follows light and dark mode without any color of its own.
 */
export function tintFor(percent: string | null | undefined): React.CSSProperties | undefined {
  const value = percent === null || percent === undefined ? NaN : Number(percent);
  if (!Number.isFinite(value) || value === 0) return undefined;
  const strength = Math.min(Math.abs(value) / FULL_TINT_AT, 1) * MAX_TINT_PERCENT;
  const token = value > 0 ? "--gain" : "--loss";
  return {
    backgroundColor: `color-mix(in srgb, var(${token}) ${strength.toFixed(1)}%, transparent)`,
  };
}

function Cell({ percent }: { percent: string | null | undefined }) {
  return (
    <td className="px-1.5 py-1.5 text-right" style={tintFor(percent)}>
      {percent === null || percent === undefined
        ? PLACEHOLDER
        : formatPercent(percent, { signed: true })}
    </td>
  );
}

function MonthHeader({ index }: { index: number }) {
  const name = MONTHS[index]!;
  return (
    <th scope="col" className="px-1.5 py-2 text-right font-semibold">
      <span aria-hidden="true">{name.slice(0, 3)}</span>
      <VisuallyHidden>{name}</VisuallyHidden>
    </th>
  );
}

/**
 * Year by month table of returns, newest year first, with the average, median and share of up
 * years for each calendar month above it. It scrolls sideways on narrow screens; the scroll area is
 * focusable so keyboard users can reach the off-screen columns. It is `relative` on purpose: the
 * screen-reader-only text is absolutely positioned and would otherwise escape the scroll area's
 * clipping and widen the whole page.
 */
export function SeasonalityGrid({ data }: { data: Seasonality }) {
  const byMonth = new Map(data.months.map((month) => [month.month, month]));
  const years = [...data.years].reverse();

  return (
    <div
      role="region"
      aria-label={`Monthly returns for ${data.symbol}, scrollable`}
      tabIndex={0}
      className="focus-visible:outline-focus relative overflow-x-auto rounded-md focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <table className="w-full min-w-[44rem] text-left text-xs tabular-nums">
        <caption className="sr-only">
          Month-to-month price return of {data.symbol} for each calendar month and year, newest year
          first, with the average, median and share of up years for each month
        </caption>
        <thead>
          <tr className="border-border border-b">
            <th scope="col" className="bg-surface-raised sticky left-0 py-2 pr-2 font-semibold">
              Year
            </th>
            {MONTHS.map((_, index) => (
              <MonthHeader key={index} index={index} />
            ))}
          </tr>
        </thead>
        <tbody className="border-border border-b-2">
          <tr>
            <th scope="row" className="bg-surface-raised sticky left-0 py-1.5 pr-2 font-semibold">
              Average
            </th>
            {MONTHS.map((_, index) => (
              <Cell key={index} percent={byMonth.get(index + 1)?.average} />
            ))}
          </tr>
          <tr>
            <th scope="row" className="bg-surface-raised sticky left-0 py-1.5 pr-2 font-semibold">
              Median
            </th>
            {MONTHS.map((_, index) => (
              <Cell key={index} percent={byMonth.get(index + 1)?.median} />
            ))}
          </tr>
          <tr>
            <th scope="row" className="bg-surface-raised sticky left-0 py-1.5 pr-2 font-semibold">
              Years up
            </th>
            {MONTHS.map((_, index) => {
              const month = byMonth.get(index + 1);
              return (
                <td key={index} className="px-1.5 py-1.5 text-right">
                  {month ? formatPercent(month.win_rate, { digits: 0 }) : PLACEHOLDER}
                </td>
              );
            })}
          </tr>
        </tbody>
        <tbody>
          {years.map((row) => (
            <tr key={row.year} className="border-border border-b last:border-0">
              <th scope="row" className="bg-surface-raised sticky left-0 py-1.5 pr-2 font-normal">
                {row.year}
              </th>
              {MONTHS.map((_, index) => (
                <Cell key={index} percent={row.returns[index]} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

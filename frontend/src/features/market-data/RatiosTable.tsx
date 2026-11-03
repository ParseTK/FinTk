import { formatDate, formatNumber, formatPercent, PLACEHOLDER } from "@/lib/format";
import type { RatioSeries } from "./types";

const YEARS_SHOWN = 5;

function Cell({ ratio, value }: { ratio: RatioSeries; value: string | null | undefined }) {
  if (value == null) {
    // A dash for the eye, and the words for a screen reader: a bare dash is not read as "missing".
    return (
      <>
        <span aria-hidden="true">{PLACEHOLDER}</span>
        <span className="sr-only">Not available</span>
      </>
    );
  }
  return (
    <>{ratio.unit === "percent" ? formatPercent(value, { digits: 1 }) : formatNumber(value)}</>
  );
}

/**
 * The ratios as one table, a column per fiscal year (newest first) and a row per ratio. Plain
 * numbers on purpose: no colour or arrows, because a ratio is arithmetic on published figures and
 * not a verdict. A figure that could not be worked out reads "Not available".
 */
export function RatiosTable({ ratios }: { ratios: readonly RatioSeries[] }) {
  const periods = [...new Set(ratios.flatMap((ratio) => ratio.values.map((v) => v.period_end)))]
    .sort()
    .reverse()
    .slice(0, YEARS_SHOWN);
  if (ratios.length === 0 || periods.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm tabular-nums">
          <caption className="sr-only">
            Ratios worked out from the company&apos;s annual SEC filings, most recent fiscal year
            first
          </caption>
          <thead>
            <tr className="border-border border-b">
              <th scope="col" className="py-2 pr-4 font-semibold">
                <span className="sr-only">Ratio</span>
              </th>
              {periods.map((period) => (
                <th key={period} scope="col" className="px-2 py-2 text-right font-semibold">
                  {formatDate(period, "month-year")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ratios.map((ratio) => {
              const values = new Map(ratio.values.map((v) => [v.period_end, v.value]));
              return (
                <tr key={ratio.ratio} className="border-border border-b last:border-0">
                  <th scope="row" className="text-fg-muted py-2 pr-4 font-normal">
                    {ratio.label}
                    {ratio.unit === "times" && " (times)"}
                  </th>
                  {periods.map((period) => (
                    <td key={period} className="px-2 py-2 text-right">
                      <Cell ratio={ratio} value={values.get(period)} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <details className="text-sm">
        <summary className="text-brand cursor-pointer font-medium underline-offset-2 hover:underline">
          How each ratio is worked out
        </summary>
        <dl className="mt-3 space-y-2">
          {ratios.map((ratio) => (
            <div key={ratio.ratio}>
              <dt className="font-medium">{ratio.label}</dt>
              <dd className="text-fg-muted">{ratio.formula}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}

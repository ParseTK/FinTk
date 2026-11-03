import { formatCompact, formatDate, formatMoney, PLACEHOLDER } from "@/lib/format";
import type { Financials, MetricSeries } from "./types";

/** The metrics worth showing first, in reading order, with their labels. */
const ROWS: { metric: string; label: string }[] = [
  { metric: "revenue", label: "Revenue" },
  { metric: "gross_profit", label: "Gross profit" },
  { metric: "operating_income", label: "Operating income" },
  { metric: "net_income", label: "Net income" },
  { metric: "eps_diluted", label: "Diluted EPS" },
  { metric: "operating_cash_flow", label: "Cash from operations" },
  { metric: "assets", label: "Total assets" },
  { metric: "liabilities", label: "Total liabilities" },
  { metric: "equity", label: "Shareholders’ equity" },
  { metric: "cash", label: "Cash and equivalents" },
];

function formatValue(series: MetricSeries, value: string | undefined): string {
  if (value === undefined) return PLACEHOLDER;
  // Per-share figures are small, so show cents; everything else is shown compactly (e.g. $416.2B).
  if (series.unit === "USD/shares") return formatMoney(value);
  const negative = value.startsWith("-");
  return `${negative ? "-" : ""}$${formatCompact(negative ? value.slice(1) : value)}`;
}

export function FinancialsTable({ financials }: { financials: Financials }) {
  const byMetric = new Map(financials.metrics.map((series) => [series.metric, series]));
  const periods = [
    ...new Set(financials.metrics.flatMap((series) => series.values.map((v) => v.period_end))),
  ]
    .sort()
    .reverse()
    .slice(0, 5);
  const rows = ROWS.flatMap(({ metric, label }) => {
    const series = byMetric.get(metric);
    return series ? [{ label, series }] : [];
  });
  if (rows.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm tabular-nums">
        <caption className="sr-only">
          Annual financial results from SEC filings, most recent fiscal year first
        </caption>
        <thead>
          <tr className="border-border border-b">
            <th scope="col" className="py-2 pr-4 font-semibold">
              <span className="sr-only">Metric</span>
            </th>
            {periods.map((period) => (
              <th key={period} scope="col" className="px-2 py-2 text-right font-semibold">
                {formatDate(period, "month-year")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, series }) => {
            const values = new Map(series.values.map((v) => [v.period_end, v.value]));
            return (
              <tr key={series.metric} className="border-border border-b last:border-0">
                <th scope="row" className="text-fg-muted py-2 pr-4 font-normal">
                  {label}
                </th>
                {periods.map((period) => (
                  <td key={period} className="px-2 py-2 text-right">
                    {formatValue(series, values.get(period))}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

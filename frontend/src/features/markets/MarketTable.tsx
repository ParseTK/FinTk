import { Change } from "@/components/ui/Change";
import { Card } from "@/components/ui/Card";
import type { MarketRow } from "./types";

const COLUMNS = [
  { key: "last_month", label: "Last month" },
  { key: "year_to_date", label: "Year to date" },
  { key: "trailing_12_months", label: "Past 12 months" },
  { key: "annualized", label: "Per year, long run" },
] as const;

function Name({ row }: { row: MarketRow }) {
  return (
    <>
      <span className="font-medium">{row.name}</span>{" "}
      <span className="text-fg-muted text-sm">{row.symbol}</span>
    </>
  );
}

/**
 * One group of rows (the indices, or the sectors). Wider screens get a real table; phones get one
 * card per row with the same figures labelled, so nothing needs sideways scrolling.
 */
export function MarketTable({ caption, rows }: { caption: string; rows: readonly MarketRow[] }) {
  return (
    <>
      <Card className="hidden rounded-2xl p-2 sm:p-4 md:block">
        <table className="w-full text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="text-fg-muted text-sm">
              <th scope="col" className="px-3 py-2 font-medium">
                Name
              </th>
              {COLUMNS.map((column) => (
                <th key={column.key} scope="col" className="px-3 py-2 text-right font-medium">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.symbol} className="border-border border-t">
                <th scope="row" className="px-3 py-3 text-left font-normal">
                  <Name row={row} />
                </th>
                {COLUMNS.map((column) => (
                  <td key={column.key} className="px-3 py-3 text-right">
                    <Figure row={row} column={column.key} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <ul aria-label={caption} className="space-y-3 md:hidden">
        {rows.map((row) => (
          <li key={row.symbol}>
            <Card as="article" className="space-y-3 rounded-2xl">
              <h3>
                <Name row={row} />
              </h3>
              {row.figures ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  {COLUMNS.map((column) => (
                    <div key={column.key}>
                      <dt className="text-fg-muted">{column.label}</dt>
                      <dd className="mt-0.5 text-base">
                        <Figure row={row} column={column.key} />
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-fg-muted text-sm">Not loaded yet</p>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}

function Figure({ row, column }: { row: MarketRow; column: (typeof COLUMNS)[number]["key"] }) {
  const figures = row.figures;
  if (!figures) return <span className="text-fg-muted">Not loaded yet</span>;
  const value = figures[column];
  if (column !== "annualized") return <Change value={value} />;
  return (
    <span className="inline-flex flex-col items-end">
      <Change value={value} />
      {value != null && <span className="text-fg-muted text-xs">since {figures.since_year}</span>}
    </span>
  );
}

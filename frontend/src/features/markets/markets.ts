import type { MarketRow } from "./types";

/** Rows that have figures, best year to date first; rows without a year-to-date figure go last. */
export function rankByYearToDate(rows: readonly MarketRow[]): MarketRow[] {
  const value = (row: MarketRow) => {
    const ytd = row.figures?.year_to_date;
    return ytd == null ? null : Number(ytd);
  };
  return [...rows].sort((a, b) => {
    const left = value(a);
    const right = value(b);
    if (left === null && right === null) return a.symbol.localeCompare(b.symbol);
    if (left === null) return 1;
    if (right === null) return -1;
    return right - left || a.symbol.localeCompare(b.symbol);
  });
}

/** The largest size (ignoring sign) among the year-to-date figures, to scale bars; 0 if none. */
export function largestMove(rows: readonly MarketRow[]): number {
  return rows.reduce((largest, row) => {
    const ytd = row.figures?.year_to_date;
    return ytd == null ? largest : Math.max(largest, Math.abs(Number(ytd)));
  }, 0);
}

/** "Oct 2026" style label for the month a row is measured to. */
export function asOfLabel(row: MarketRow): string | null {
  const figures = row.figures;
  if (!figures) return null;
  const date = new Date(Date.UTC(figures.as_of_year, figures.as_of_month - 1, 1));
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

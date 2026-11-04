import type { MajorCoin } from "./types";

export interface SeriesPoint {
  /** Days before the latest price. 0 is now. */
  daysAgo: number;
  price: number;
}

export interface PriceSeries {
  /** Oldest first, ending with the latest price. */
  points: readonly SeriesPoint[];
  /** The change over the whole span, in percent points, as the API reported it. */
  spanChange: string;
  /** How far back the first point is. */
  spanDays: number;
}

const DAY = 86_400_000;

function daysBetween(from: string | null, to: string): number | null {
  if (!from) return null;
  const start = Date.parse(from);
  const end = Date.parse(to);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.round((end - start) / DAY);
}

/**
 * A rough price path for one coin, worked out from the price now and the percent changes the API
 * reports over fixed periods (24 hours, 7, 30 and 90 days, year to date, past year): the price then
 * is the price now divided by one plus the change. It is a handful of real, dated points, not a
 * full history, and the page says so. Returns null when fewer than four points can be worked out,
 * so the caller shows nothing rather than a misleading line.
 */
export function priceSeries(
  coin: MajorCoin,
  dates: { yearStart: string | null; pastYearStart: string | null },
  asOf: string,
): PriceSeries | null {
  const now = Number(coin.price);
  if (!Number.isFinite(now) || now <= 0) return null;

  const windows: ReadonlyArray<readonly [number | null, string | null]> = [
    [1, coin.change_24h],
    [7, coin.change_7d],
    [30, coin.change_30d],
    [90, coin.change_90d],
    [daysBetween(dates.yearStart, asOf), coin.change_year_to_date],
    [daysBetween(dates.pastYearStart, asOf), coin.change_past_year],
  ];

  const byDays = new Map<number, { point: SeriesPoint; change: string }>();
  for (const [days, change] of windows) {
    // A blank string would read as 0 (Number("") is 0), so it is refused here, not guessed at.
    if (days === null || days <= 0 || byDays.has(days) || change === null) continue;
    if (change.trim() === "") continue;
    const percent = Number(change);
    if (!Number.isFinite(percent) || percent <= -100) continue;
    byDays.set(days, { point: { daysAgo: days, price: now / (1 + percent / 100) }, change });
  }

  const found = [...byDays.values()].sort((a, b) => b.point.daysAgo - a.point.daysAgo);
  if (found.length < 3) return null;
  const oldest = found[0]!;
  return {
    points: [...found.map((entry) => entry.point), { daysAgo: 0, price: now }],
    spanChange: oldest.change,
    spanDays: oldest.point.daysAgo,
  };
}

/** "past year", "past 90 days" and so on, for the span a series covers. */
export function spanLabel(days: number): string {
  if (days >= 330) return "past year";
  return `past ${days} days`;
}

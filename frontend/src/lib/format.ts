/**
 * Display formatting. All figures go through Intl so the app has one place that decides how numbers
 * look. Money arrives as a string (as the API will send it) and is only formatted here, never added
 * or multiplied as a float. Missing or non-numeric input renders as an em dash.
 */

export const PLACEHOLDER = "—";

const DEFAULT_LOCALE = "en-US";

type Numeric = string | number | null | undefined;

/** Intl accepts decimal strings without rounding them through a float; the types do not know that yet. */
function parse(value: Numeric): number | `${number}` | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const trimmed = value.trim();
  if (trimmed === "" || !Number.isFinite(Number(trimmed))) return null;
  return trimmed as `${number}`;
}

export function isNegative(value: Numeric): boolean {
  const parsed = parse(value);
  return parsed !== null && Number(parsed) < 0;
}

export function isPositive(value: Numeric): boolean {
  const parsed = parse(value);
  return parsed !== null && Number(parsed) > 0;
}

export interface MoneyOptions {
  currency?: string;
  /** Show an explicit + for positive amounts (used for changes). */
  signed?: boolean;
  locale?: string;
}

export function formatMoney(value: Numeric, options: MoneyOptions = {}): string {
  const { currency = "USD", signed = false, locale = DEFAULT_LOCALE } = options;
  const parsed = parse(value);
  if (parsed === null) return PLACEHOLDER;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    signDisplay: signed ? "exceptZero" : "auto",
  }).format(parsed);
}

export interface PercentOptions {
  /** Digits after the decimal point. Default 2. */
  digits?: number;
  signed?: boolean;
  locale?: string;
}

/** `value` is in percent points: 5.76 means 5.76%, not 576%. */
export function formatPercent(value: Numeric, options: PercentOptions = {}): string {
  const { digits = 2, signed = false, locale = DEFAULT_LOCALE } = options;
  const parsed = parse(value);
  if (parsed === null) return PLACEHOLDER;
  const number = new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: signed ? "exceptZero" : "auto",
  }).format(parsed);
  return `${number}%`;
}

/** 1234567 -> "1.2M". */
export function formatCompact(value: Numeric, locale: string = DEFAULT_LOCALE): string {
  const parsed = parse(value);
  if (parsed === null) return PLACEHOLDER;
  return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(
    parsed,
  );
}

export function formatNumber(value: Numeric, digits = 2, locale: string = DEFAULT_LOCALE): string {
  const parsed = parse(value);
  if (parsed === null) return PLACEHOLDER;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(parsed);
}

export type DateStyle = "short" | "medium" | "long" | "month-year";

const DATE_OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  short: { year: "2-digit", month: "numeric", day: "numeric" },
  medium: { year: "numeric", month: "short", day: "numeric" },
  long: { year: "numeric", month: "long", day: "numeric" },
  "month-year": { year: "numeric", month: "short" },
};

/**
 * Formats an ISO date or date-time. Formatted in UTC so a date-only value like "2024-08-01"
 * never shifts to the previous day in a western time zone.
 */
export function formatDate(
  value: string | Date | null | undefined,
  style: DateStyle = "medium",
  locale: string = DEFAULT_LOCALE,
): string {
  if (value === null || value === undefined) return PLACEHOLDER;
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return PLACEHOLDER;
  return new Intl.DateTimeFormat(locale, { ...DATE_OPTIONS[style], timeZone: "UTC" }).format(date);
}

/** SEC stores a fiscal year end as "MMDD" ("0926"). Returns "September 26", or null if unreadable. */
export function formatFiscalYearEnd(value: string | null | undefined): string | null {
  const match = /^(\d{2})(\d{2})$/.exec(value ?? "");
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // 2000 is a leap year, so every valid month/day pair (including Feb 29) exists.
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2000, month - 1, day)));
}

/** A share count: up to six decimals, with trailing zeros dropped ("12.500000" -> "12.5"). */
export function formatShares(value: Numeric, locale: string = DEFAULT_LOCALE): string {
  const parsed = parse(value);
  if (parsed === null) return PLACEHOLDER;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  }).format(parsed);
}

/** A price per share in dollars: at least cents, up to six decimals when the price needs them. */
export function formatPrice(value: Numeric, locale: string = DEFAULT_LOCALE): string {
  const parsed = parse(value);
  if (parsed === null) return PLACEHOLDER;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(parsed);
}

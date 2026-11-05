import { formatCompact, formatPrice, formatQuote } from "@/lib/format";

/**
 * A coin price in dollars. From a cent up it reads like any quote; below a cent it keeps four
 * significant digits, so a coin worth 0.0000001234 is never shown as "$0.00".
 */
export function formatCoinPrice(value: string | null | undefined): string {
  const number = Number(value);
  if (value == null || value === "" || !Number.isFinite(number)) return "—";
  if (number > 0 && number < 0.01) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumSignificantDigits: 4,
    }).format(number);
  }
  return number < 1 ? formatPrice(value) : formatQuote(value);
}

/** A large dollar amount for display: "$1.3T", "$98B". Missing figures return null. */
export function compactUsd(value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  const text = formatCompact(value);
  return /\d/.test(text) ? `$${text}` : null;
}

const WHEN = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

/** "Nov 3, 2026, 9:00 PM UTC", or null when the time cannot be read. */
export function updatedLabel(iso: string): string | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : `${WHEN.format(date)} UTC`;
}

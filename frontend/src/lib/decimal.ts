/**
 * Exact decimal arithmetic for numbers a person types (prices, amounts, percentages). Browser
 * numbers are binary floats (0.1 + 0.2 is not 0.3), which is not acceptable for money, so values are
 * kept as a whole number of units and a count of decimal places: units / 10^scale.
 *
 * Only what the calculators need: parse, subtract, multiply, and a division that rounds half up
 * (away from zero) to a fixed number of decimals and returns a string. Nothing here touches floats.
 */

export interface Decimal {
  units: bigint;
  /** Digits after the decimal point. */
  scale: number;
}

const MAX_DIGITS = 18;
const MAX_SCALE = 12;

const pow10 = (exponent: number): bigint => 10n ** BigInt(exponent);
const abs = (value: bigint): bigint => (value < 0n ? -value : value);

/**
 * Reads text such as "1,250.50", ".5" or "-3". Returns null for anything else, including empty text,
 * more than one point, exponents, and numbers with more than 18 digits or 12 decimals.
 */
export function parseDecimal(text: string): Decimal | null {
  const cleaned = text.trim().replace(/,/g, "");
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return null;
  const negative = cleaned.startsWith("-");
  const body = negative ? cleaned.slice(1) : cleaned;
  const [whole = "", fraction = ""] = body.split(".");
  if ((whole + fraction).replace(/^0+/, "").length > MAX_DIGITS || fraction.length > MAX_SCALE) {
    return null;
  }
  const units = BigInt(`${whole || "0"}${fraction}`);
  return { units: negative ? -units : units, scale: fraction.length };
}

export const sign = (value: Decimal): -1 | 0 | 1 =>
  value.units < 0n ? -1 : value.units > 0n ? 1 : 0;

function align(a: Decimal, b: Decimal): [bigint, bigint, number] {
  const scale = Math.max(a.scale, b.scale);
  return [a.units * pow10(scale - a.scale), b.units * pow10(scale - b.scale), scale];
}

export function subtract(a: Decimal, b: Decimal): Decimal {
  const [x, y, scale] = align(a, b);
  return { units: x - y, scale };
}

export function multiply(a: Decimal, b: Decimal): Decimal {
  return { units: a.units * b.units, scale: a.scale + b.scale };
}

export function fromInteger(value: number): Decimal {
  return { units: BigInt(value), scale: 0 };
}

/** Writes `units / 10^scale` with exactly `digits` decimals, no "-0.00". */
function write(units: bigint, digits: number): string {
  const negative = units < 0n;
  const text = abs(units)
    .toString()
    .padStart(digits + 1, "0");
  const whole = text.slice(0, text.length - digits);
  const fraction = text.slice(text.length - digits);
  const body = digits > 0 ? `${whole}.${fraction}` : whole;
  return negative && abs(units) !== 0n ? `-${body}` : body;
}

/**
 * `a / b` rounded half up (away from zero on a tie) to `digits` decimals, as a string. Returns null
 * when `b` is zero.
 */
export function divide(a: Decimal, b: Decimal, digits: number): string | null {
  if (b.units === 0n) return null;
  // a/b = (a.units * 10^b.scale) / (b.units * 10^a.scale); scaled by 10^digits for the decimals.
  const numerator = a.units * pow10(b.scale + digits);
  const denominator = b.units * pow10(a.scale);
  const negative = numerator < 0n !== denominator < 0n;
  const n = abs(numerator);
  const d = abs(denominator);
  const quotient = (2n * n + d) / (2n * d);
  return write(negative ? -quotient : quotient, digits);
}

/** The value rounded half up to `digits` decimals, as a string. */
export function round(value: Decimal, digits: number): string {
  return divide(value, fromInteger(1), digits)!;
}

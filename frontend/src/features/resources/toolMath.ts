import {
  divide,
  fromInteger,
  multiply,
  parseDecimal,
  round,
  sign,
  subtract,
  type Decimal,
} from "@/lib/decimal";

/**
 * The calculations behind the Research tools page. Pure functions over exact decimals: they take the
 * text a person typed and return either a result (money and percentages as strings) or the reason
 * the numbers cannot be worked out. Nothing here is a forecast; every result is arithmetic on the
 * numbers entered.
 */

export type CalcError =
  | { kind: "missing"; field: string }
  | { kind: "invalid"; field: string }
  | { kind: "negative"; field: string }
  | { kind: "zero"; field: string }
  | { kind: "range"; field: string };

export type Result<T> = { ok: true; value: T } | { ok: false; errors: CalcError[] };

const HUNDRED = fromInteger(100);

interface FieldSpec {
  field: string;
  text: string;
  /** Whether zero is a usable value (a starting price of zero is not). */
  allowZero: boolean;
}

/** Reads each required number, collecting every problem so all of them can be shown together. */
function readAll(specs: FieldSpec[]): Result<Decimal[]> {
  const values: Decimal[] = [];
  const errors: CalcError[] = [];
  for (const { field, text, allowZero } of specs) {
    if (text.trim() === "") {
      errors.push({ kind: "missing", field });
      continue;
    }
    const value = parseDecimal(text);
    if (value === null) errors.push({ kind: "invalid", field });
    else if (sign(value) < 0) errors.push({ kind: "negative", field });
    else if (!allowZero && sign(value) === 0) errors.push({ kind: "zero", field });
    else values.push(value);
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: values };
}

export interface PercentChange {
  /** End minus start, exact. */
  difference: string;
  /** Percent points, two decimals. */
  percent: string;
}

/** From a starting number to an ending number. The start cannot be zero, because nothing is a percent of zero. */
export function percentChange(start: string, end: string): Result<PercentChange> {
  const read = readAll([
    { field: "start", text: start, allowZero: false },
    { field: "end", text: end, allowZero: true },
  ]);
  if (!read.ok) return read;
  const [from, to] = read.value as [Decimal, Decimal];
  const difference = subtract(to, from);
  return {
    ok: true,
    value: {
      difference: round(difference, Math.max(from.scale, to.scale)),
      percent: divide(multiply(difference, HUNDRED), from, 2)!,
    },
  };
}

export interface GainLoss {
  /** Amount times the current price, to the cent. */
  value: string;
  /** Value minus what was paid, to the cent. */
  gain: string;
  /** Percent points, two decimals. */
  percent: string;
}

/** What a holding is worth against what was paid for it in total. What was paid cannot be zero. */
export function gainLoss(amount: string, paid: string, price: string): Result<GainLoss> {
  const read = readAll([
    { field: "amount", text: amount, allowZero: true },
    { field: "paid", text: paid, allowZero: false },
    { field: "price", text: price, allowZero: true },
  ]);
  if (!read.ok) return read;
  const [coins, cost, now] = read.value as [Decimal, Decimal, Decimal];
  const value = multiply(coins, now);
  const gain = subtract(value, cost);
  return {
    ok: true,
    value: {
      value: round(value, 2),
      gain: round(gain, 2),
      percent: divide(multiply(gain, HUNDRED), cost, 2)!,
    },
  };
}

export interface BreakEven {
  /** The rise, in percent points, that undoes the fall. */
  rise: string;
}

/** The rise needed to get back to the starting value after a fall of `fall` percent (0 up to 100). */
export function breakEven(fall: string): Result<BreakEven> {
  const read = readAll([{ field: "fall", text: fall, allowZero: false }]);
  if (!read.ok) return read;
  const [drop] = read.value as [Decimal];
  const remaining = subtract(HUNDRED, drop);
  if (sign(remaining) <= 0) return { ok: false, errors: [{ kind: "range", field: "fall" }] };
  return { ok: true, value: { rise: divide(multiply(drop, HUNDRED), remaining, 2)! } };
}

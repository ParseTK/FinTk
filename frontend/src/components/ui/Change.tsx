import clsx from "clsx";
import { formatMoney, formatPercent, isNegative, isPositive } from "@/lib/format";

export interface ChangeProps {
  /** Percent points for kind="percent" (5.76 means 5.76%), or an amount for kind="money". */
  value: string | number | null | undefined;
  kind?: "percent" | "money";
  currency?: string;
  digits?: number;
  className?: string;
}

/**
 * A gain or loss. Direction is shown three ways, never by color alone: a +/- sign, an arrow, and
 * the number itself. Zero and missing values are neutral.
 */
export function Change({ value, kind = "percent", currency, digits, className }: ChangeProps) {
  const positive = isPositive(value);
  const negative = isNegative(value);
  const text =
    kind === "money"
      ? formatMoney(value, { currency, signed: true })
      : formatPercent(value, { digits, signed: true });

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 font-medium tabular-nums",
        positive && "text-gain",
        negative && "text-loss",
        !positive && !negative && "text-fg-muted",
        className,
      )}
    >
      {(positive || negative) && <span aria-hidden="true">{positive ? "▲" : "▼"}</span>}
      <span>{text}</span>
    </span>
  );
}

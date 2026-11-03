import clsx from "clsx";
import { Change } from "@/components/ui/Change";
import { isNegative, isPositive } from "@/lib/format";

/** A soft tint of the gain or loss color, so direction reads at a glance and never by color alone. */
function tint(gain: string): string | undefined {
  if (isPositive(gain)) return "color-mix(in srgb, var(--gain) 6%, transparent)";
  if (isNegative(gain)) return "color-mix(in srgb, var(--loss) 6%, transparent)";
  return undefined;
}

/**
 * A gain or loss as one small pill: the amount with its arrow and sign, then the percentage, smaller
 * and in parentheses, in the corner of the amount. One arrow, one place to look.
 */
export function GainChip({
  gain,
  percent,
  size = "md",
  className,
}: {
  gain: string;
  percent: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      style={{ backgroundColor: tint(gain) }}
      className={clsx(
        "inline-flex items-start gap-1.5 rounded-full font-semibold whitespace-nowrap",
        size === "sm" && "px-2 py-0.5 text-sm",
        size === "md" && "px-3 py-1 text-base",
        size === "lg" && "px-4 py-1.5 text-xl",
        className,
      )}
    >
      <Change value={gain} kind="money" />
      <span className="pt-0.5 text-xs leading-none font-medium">
        (<Change value={percent} arrow={false} />)
      </span>
    </span>
  );
}

import Link from "next/link";
import { formatCompact, formatMoney, formatPercent } from "@/lib/format";
import { computeAllocation, type Slice } from "./allocation";
import type { Holding } from "./types";

const SIZE = 120;
const CENTER = SIZE / 2;
const RADIUS = 44;
const STROKE = 16;
/** Space left between neighbouring slices, in degrees, so each reads as its own piece. */
const GAP_DEGREES = 1.6;

/** Slice colors: the palette's brand color at falling strength, so the chart follows the accent. */
const STRENGTH = [100, 74, 54, 38, 26, 16];
const fillFor = (index: number, isOther: boolean) =>
  isOther
    ? "var(--border-strong)"
    : `color-mix(in srgb, var(--brand) ${STRENGTH[index] ?? 16}%, var(--surface-raised))`;

const point = (degrees: number) => {
  const radians = ((degrees - 90) * Math.PI) / 180; // 0 degrees is straight up
  return [CENTER + RADIUS * Math.cos(radians), CENTER + RADIUS * Math.sin(radians)] as const;
};

function arc(startDegrees: number, endDegrees: number): string {
  const [x0, y0] = point(startDegrees);
  const [x1, y1] = point(endDegrees);
  const large = endDegrees - startDegrees > 180 ? 1 : 0;
  return `M ${x0.toFixed(3)} ${y0.toFixed(3)} A ${RADIUS} ${RADIUS} 0 ${large} 1 ${x1.toFixed(3)} ${y1.toFixed(3)}`;
}

function Slices({ slices }: { slices: Slice[] }) {
  if (slices.length === 1) {
    return (
      <circle
        cx={CENTER}
        cy={CENTER}
        r={RADIUS}
        fill="none"
        stroke={fillFor(0, false)}
        strokeWidth={STROKE}
      />
    );
  }
  const spans = slices.map((slice) => slice.share * 360);
  const starts = spans.map((_, index) =>
    spans.slice(0, index).reduce((sum, span) => sum + span, 0),
  );
  return slices.map((slice, index) => {
    const gap = Math.min(GAP_DEGREES, spans[index]! / 3);
    const from = starts[index]! + gap / 2;
    const to = starts[index]! + spans[index]! - gap / 2;
    return (
      <path
        key={slice.key}
        d={arc(from, to)}
        pathLength={1}
        fill="none"
        stroke={fillFor(index, slice.symbol === null)}
        strokeWidth={STROKE}
        strokeDasharray={1}
        // Each slice draws itself in turn. The Motion setting stops this: slices are just there.
        className="motion-safe:animate-draw"
        style={{ animationDelay: `${index * 120}ms` }}
      />
    );
  });
}

/**
 * How the portfolio is split across companies: a donut, and beside it a list that carries the same
 * information in text (company, share, amount). The chart is decorative for assistive technology;
 * the list is the accessible version, and color is never the only way to tell slices apart.
 */
export function AllocationChart({ holdings }: { holdings: Holding[] }) {
  const allocation = computeAllocation(holdings);
  if (!allocation || holdings.length < 2) return null;
  const caption = allocation.basis === "value" ? "current value" : "amount paid";

  return (
    <section aria-labelledby="allocation-heading" className="flex flex-wrap items-center gap-6">
      <div className="relative size-36 shrink-0">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          aria-hidden="true"
          focusable="false"
          className="size-full"
        >
          <Slices slices={allocation.slices} />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-lg font-semibold tabular-nums">
            ${formatCompact(allocation.total)}
          </span>
          <span className="text-fg-muted text-xs">{allocation.basis}</span>
        </div>
      </div>

      {/* At least 15rem wide: below that it wraps under the donut instead of squeezing the names. */}
      <div className="max-w-md min-w-[15rem] flex-1 space-y-2">
        <h3 id="allocation-heading" className="text-sm font-semibold">
          Allocation by {caption}
        </h3>
        <ul className="space-y-1.5 text-sm">
          {allocation.slices.map((slice, index) => (
            <li key={slice.key} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="border-border-strong size-3 shrink-0 rounded-sm border"
                style={{ background: fillFor(index, slice.symbol === null) }}
              />
              <span className="min-w-14 flex-1 truncate font-medium">
                {slice.symbol ? (
                  <Link
                    href={`/company/${encodeURIComponent(slice.symbol)}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {slice.label}
                  </Link>
                ) : (
                  slice.label
                )}
              </span>
              <span className="tabular-nums">
                {formatPercent(slice.share * 100, { digits: 1 })}
              </span>
              <span className="text-fg-muted w-24 text-right tabular-nums">
                {formatMoney(slice.amount)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

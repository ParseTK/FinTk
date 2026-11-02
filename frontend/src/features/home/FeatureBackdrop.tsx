import clsx from "clsx";
import { useId } from "react";

/**
 * Layered background art for the feature section: three SVG layers that drift at different speeds
 * as you scroll, which is what reads as depth. Everything is drawn with theme tokens, so it follows
 * the accent and light/dark mode, and it is decorative (the caller hides it from assistive tech).
 *
 * The composition is deliberately restrained: one idea per layer and nothing that competes with the
 * content.
 *
 *   far   concentric orbit rings        lags far behind the page  (slow)
 *   mid   large soft colour orbs        lags a little behind it
 *   near  one chart curve + soft dots   moves AGAINST the page    (fast), so it appears in front
 *
 * Parallax needs scroll-driven animation; without it (or with Motion reduced, or the scroll_motion
 * flag off) the layers simply sit still as a composed background.
 */

const RING_RADII = [120, 220, 330, 450, 580] as const;

/** Points that lie exactly on the curve below, where the node markers sit. */
const CURVE_PATH =
  "M-20 700C160 650 260 740 420 650S640 540 780 580 1020 430 1160 380 1320 290 1420 230";
const CURVE_NODES = [
  [420, 650],
  [780, 580],
  [1160, 380],
] as const;

/** Small soft dots at different sizes: a little bokeh, for depth rather than meaning. */
const DOTS = [
  [180, 190, 5],
  [345, 520, 3],
  [1010, 120, 4],
  [1245, 540, 6],
  [565, 820, 4],
  [865, 60, 3],
] as const;

/** One full-bleed layer, taller than the section so its drift never exposes an edge. */
function Layer({
  animated,
  drift,
  children,
}: {
  animated: boolean;
  /** Tailwind arbitrary properties giving the travel (from / to) for this layer. */
  drift: string;
  children: React.ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 1400 900"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={clsx(
        "absolute inset-x-0 top-[calc(50%-450px)] h-[900px] w-full",
        animated && ["parallax", drift],
      )}
    >
      {children}
    </svg>
  );
}

export function FeatureBackdrop({ animated }: { animated: boolean }) {
  const orbId = useId();
  const orbSoftId = useId();
  const curveId = useId();

  return (
    <>
      <svg width="0" height="0" aria-hidden="true" focusable="false" className="absolute">
        <defs>
          <radialGradient id={orbId}>
            <stop offset="0%" style={{ stopColor: "var(--brand)", stopOpacity: 0.34 }} />
            <stop offset="100%" style={{ stopColor: "var(--brand)", stopOpacity: 0 }} />
          </radialGradient>
          <radialGradient id={orbSoftId}>
            <stop offset="0%" style={{ stopColor: "var(--brand)", stopOpacity: 0.2 }} />
            <stop offset="100%" style={{ stopColor: "var(--brand)", stopOpacity: 0 }} />
          </radialGradient>
          {/* The curve fades out at both ends instead of stopping in a hard line. */}
          <linearGradient id={curveId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" style={{ stopColor: "var(--brand)", stopOpacity: 0 }} />
            <stop offset="22%" style={{ stopColor: "var(--brand)", stopOpacity: 0.5 }} />
            <stop offset="78%" style={{ stopColor: "var(--brand)", stopOpacity: 0.5 }} />
            <stop offset="100%" style={{ stopColor: "var(--brand)", stopOpacity: 0 }} />
          </linearGradient>
        </defs>
      </svg>

      {/* Far: orbit rings that barely move. */}
      <Layer animated={animated} drift="[--parallax-from:-36px] [--parallax-to:36px]">
        {RING_RADII.map((r, index) => (
          <circle
            key={r}
            cx="700"
            cy="450"
            r={r}
            className="stroke-brand/20"
            strokeWidth="1.5"
            strokeDasharray={index % 2 === 1 ? "3 10" : undefined}
          />
        ))}
      </Layer>

      {/* Mid: large soft orbs that drift with the page. */}
      <Layer animated={animated} drift="[--parallax-from:-110px] [--parallax-to:110px]">
        <circle cx="260" cy="300" r="320" fill={"url(#" + orbId + ")"} />
        <circle cx="1150" cy="620" r="360" fill={"url(#" + orbId + ")"} />
        <circle cx="720" cy="110" r="220" fill={"url(#" + orbSoftId + ")"} />
      </Layer>

      {/* Near: a single graceful curve and a few soft dots, moving against the page. */}
      <Layer animated={animated} drift="[--parallax-from:190px] [--parallax-to:-190px]">
        <path
          d={CURVE_PATH}
          stroke={"url(#" + curveId + ")"}
          strokeWidth="3"
          strokeLinecap="round"
        />
        {CURVE_NODES.map(([cx, cy]) => (
          <g key={cx}>
            <circle cx={cx} cy={cy} r="12" className="fill-brand/20" />
            <circle
              cx={cx}
              cy={cy}
              r="5"
              className="fill-surface stroke-brand/70"
              strokeWidth="2"
            />
          </g>
        ))}
        {DOTS.map(([cx, cy, r]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} className="fill-brand/30" />
        ))}
      </Layer>
    </>
  );
}

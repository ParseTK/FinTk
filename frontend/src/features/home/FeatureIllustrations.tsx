import clsx from "clsx";

/**
 * Small decorative illustrations for the feature cards. Every stroke is a path with pathLength 1 so
 * the draw-on-scroll animation can trace it. With no animation (flag off, reduced motion, or a
 * browser without scroll-driven animation) they are simply drawn in full.
 */

interface IllustrationProps {
  /** Adds the scroll-driven drawing. Off renders the finished drawing with no motion. */
  animated: boolean;
}

const svgProps = {
  viewBox: "0 0 160 96",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 3,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
  className: "text-brand h-full w-full",
} as const;

/** A stroke that can be traced. `order` staggers when it starts drawing. */
function Stroke({ d, order, animated }: { d: string; order: number; animated: boolean }) {
  return (
    <path
      d={d}
      pathLength={1}
      strokeDasharray="1"
      className={clsx(animated && "draw-on-scroll")}
      style={{ "--i": order } as React.CSSProperties}
    />
  );
}

export function ResearchIllustration({ animated }: IllustrationProps) {
  return (
    <svg {...svgProps}>
      <Stroke
        animated={animated}
        order={0}
        d="M52 14h34l12 12v50a6 6 0 0 1-6 6H52a6 6 0 0 1-6-6V20a6 6 0 0 1 6-6z"
      />
      <Stroke animated={animated} order={1} d="M86 14v12h12" />
      <Stroke animated={animated} order={2} d="M56 40h30" />
      <Stroke animated={animated} order={3} d="M56 54h30" />
      <Stroke animated={animated} order={4} d="M56 68h18" />
      <Stroke animated={animated} order={5} d="M124 52a16 16 0 1 1-32 0 16 16 0 0 1 32 0z" />
      <Stroke animated={animated} order={6} d="M120 64l14 14" />
    </svg>
  );
}

export function TrackIllustration({ animated }: IllustrationProps) {
  return (
    <svg {...svgProps}>
      <Stroke
        animated={animated}
        order={0}
        d="M64 14h32a6 6 0 0 1 6 6v62l-22-14-22 14V20a6 6 0 0 1 6-6z"
      />
      <Stroke animated={animated} order={1} d="M20 30h26" />
      <Stroke animated={animated} order={2} d="M20 48h26" />
      <Stroke animated={animated} order={3} d="M20 66h26" />
      <Stroke animated={animated} order={4} d="M114 30h26" />
      <Stroke animated={animated} order={5} d="M114 48h26" />
      <Stroke animated={animated} order={6} d="M114 66h26" />
    </svg>
  );
}

export function UnderstandIllustration({ animated }: IllustrationProps) {
  return (
    <svg {...svgProps}>
      <Stroke animated={animated} order={0} d="M22 80h116" />
      <Stroke animated={animated} order={1} d="M22 16v64" />
      <Stroke animated={animated} order={2} d="M30 66L52 52L70 60L94 34L116 44L138 20" />
      <circle cx="138" cy="20" r="4.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

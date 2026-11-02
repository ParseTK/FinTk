import { useId, type CSSProperties } from "react";

/**
 * The three feature icons. Each is a clean duotone line icon drawn on a 96 x 96 grid with theme
 * tokens, so it follows the accent and light/dark mode. Each has a short, one-shot animation that
 * acts out its name when the card (the `group`) is hovered or focused:
 *
 *   Research    a magnifier reads the document line by line, each line lighting up as it is read
 *   Track       the bookmark drops in and settles, its trend line redraws, the end point pings
 *   Understand  the bulb brightens, a glow comes on, and the rays flare out one by one
 *
 * They are decorative (aria-hidden). Every animation is gated by motion-safe, so the Motion setting
 * (and a device reduced-motion preference) leaves them as still, complete icons.
 */

const svgProps = {
  viewBox: "0 0 96 96",
  fill: "none",
  "aria-hidden": true,
  focusable: false,
  className: "h-full w-full overflow-visible",
} as const;

const STROKE = { strokeLinecap: "round", strokeLinejoin: "round" } as const;

/**
 * Plays an animation while the surrounding card is hovered or contains focus. These class names are
 * written out in full on purpose: Tailwind only generates CSS for class names it can read in the
 * source, so they must never be assembled from parts at runtime.
 */
const ON_GROUP = {
  lensScan:
    "motion-safe:group-hover:animate-lens-scan motion-safe:group-focus-within:animate-lens-scan",
  pin: "motion-safe:group-hover:animate-pin motion-safe:group-focus-within:animate-pin",
  redraw: "motion-safe:group-hover:animate-redraw motion-safe:group-focus-within:animate-redraw",
  pingDot:
    "motion-safe:group-hover:animate-ping-dot motion-safe:group-focus-within:animate-ping-dot",
  ray: "motion-safe:group-hover:animate-ray motion-safe:group-focus-within:animate-ray",
  bulb: "motion-safe:group-hover:animate-bulb motion-safe:group-focus-within:animate-bulb",
} as const;

export function ResearchIcon() {
  // The lines light up in step with the magnifier reaching them (see lens-scan in globals.css).
  const line = "stroke-fg-muted/50 transition-[stroke] duration-300 group-hover:stroke-brand";
  return (
    <svg {...svgProps}>
      <path
        d="M26 12h28l18 18v48a6 6 0 0 1-6 6H26a6 6 0 0 1-6-6V18a6 6 0 0 1 6-6z"
        className="fill-brand/10 stroke-brand"
        strokeWidth="3"
        {...STROKE}
      />
      <path d="M54 12v18h18" className="stroke-brand" strokeWidth="3" {...STROKE} />
      <path d="M30 44h24" className={`${line} delay-[350ms]`} strokeWidth="4" {...STROKE} />
      <path d="M30 54h28" className={`${line} delay-[1100ms]`} strokeWidth="4" {...STROKE} />
      <path d="M30 64h20" className={`${line} delay-[1800ms]`} strokeWidth="4" {...STROKE} />
      <g className={ON_GROUP.lensScan}>
        <circle cx="64" cy="64" r="14" className="fill-surface/70 stroke-brand" strokeWidth="4" />
        <path d="M74 74l10 10" className="stroke-brand" strokeWidth="6" {...STROKE} />
        <path d="M57 60a8 8 0 0 1 5-4" className="stroke-brand/50" strokeWidth="3" {...STROKE} />
      </g>
    </svg>
  );
}

export function TrackIcon() {
  return (
    <svg {...svgProps}>
      <g className={ON_GROUP.pin}>
        <path
          d="M28 14h40a6 6 0 0 1 6 6v58L48 64 22 78V20a6 6 0 0 1 6-6z"
          className="fill-brand/10 stroke-brand group-hover:fill-brand/30 transition-[fill] duration-500"
          strokeWidth="3"
          {...STROKE}
        />
        <path
          d="M33 50l9-9 7 6 13-15"
          pathLength={1}
          strokeDasharray="1"
          className={`stroke-brand ${ON_GROUP.redraw}`}
          strokeWidth="4"
          {...STROKE}
        />
        <circle
          cx="62"
          cy="32"
          r="3.5"
          className={`fill-brand origin-center [transform-box:fill-box] ${ON_GROUP.pingDot}`}
        />
      </g>
    </svg>
  );
}

// Rays fan out around the top of the bulb: [angle in degrees, 0 = right, 90 = straight up].
const RAY_ANGLES = [200, 160, 125, 90, 55, 20, -20] as const;
const BULB_CENTER = { x: 48, y: 35 };
const rays = RAY_ANGLES.map((angle) => {
  const rad = (angle * Math.PI) / 180;
  const point = (radius: number) =>
    `${(BULB_CENTER.x + radius * Math.cos(rad)).toFixed(1)} ${(BULB_CENTER.y - radius * Math.sin(rad)).toFixed(1)}`;
  return `M${point(30)} L${point(38)}`;
});

export function UnderstandIcon() {
  const glowId = useId();
  return (
    <svg {...svgProps}>
      <defs>
        <radialGradient id={glowId}>
          <stop offset="0%" style={{ stopColor: "var(--brand)", stopOpacity: 0.45 }} />
          <stop offset="100%" style={{ stopColor: "var(--brand)", stopOpacity: 0 }} />
        </radialGradient>
      </defs>
      <g transform="translate(0 6)">
        <circle
          cx="48"
          cy="35"
          r="44"
          fill={"url(#" + glowId + ")"}
          className="opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        />
        {rays.map((d, index) => (
          <path
            key={d}
            d={d}
            pathLength={1}
            strokeDasharray="1"
            className={`stroke-brand opacity-30 ${ON_GROUP.ray}`}
            style={{ animationDelay: `${index * 70}ms` } as CSSProperties}
            strokeWidth="3.5"
            {...STROKE}
          />
        ))}
        <g className={`origin-center [transform-box:fill-box] ${ON_GROUP.bulb}`}>
          <path
            d="M48 14c-13 0-22 9-22 21 0 8 4 13 8 17 3 3 4 6 4 10v2h20v-2c0-4 1-7 4-10 4-4 8-9 8-17 0-12-9-21-22-21z"
            className="fill-brand/10 stroke-brand group-hover:fill-brand/40 transition-[fill] duration-500"
            strokeWidth="3"
            {...STROKE}
          />
          <path
            d="M44 58v-7c0-4 2-6 4-6s4 2 4 6v7"
            className="stroke-brand"
            strokeWidth="3"
            {...STROKE}
          />
          <path d="M40 72h16" className="stroke-brand" strokeWidth="3" {...STROKE} />
          <path d="M43 80h10" className="stroke-brand" strokeWidth="3" {...STROKE} />
        </g>
      </g>
    </svg>
  );
}

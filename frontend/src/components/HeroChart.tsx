import { useId } from "react";

// Illustrative data only: a gently noisy upward trend. It is not real market data.
const LINE: ReadonlyArray<readonly [number, number]> = [
  [32, 236],
  [76, 214],
  [118, 226],
  [162, 184],
  [206, 196],
  [250, 150],
  [294, 164],
  [338, 112],
  [382, 126],
  [426, 72],
];
const VOLUME = [22, 34, 18, 40, 28, 46, 24, 52, 30, 58];
const GRID_Y = [64, 112, 160, 208];

const linePoints = LINE.map(([x, y]) => `${x},${y}`).join(" ");
const areaPath = `M${LINE[0]![0]},${LINE[0]![1]} ${LINE.slice(1)
  .map(([x, y]) => `L${x},${y}`)
  .join(" ")} L${LINE[LINE.length - 1]![0]},284 L${LINE[0]![0]},284 Z`;

/**
 * Original hero illustration: a rising price chart drawn with theme tokens, so it follows the
 * accent color and light/dark mode. Replaces the earlier stock photo.
 */
export function HeroChart({ className }: { className?: string }) {
  const gradientId = useId();
  const [endX, endY] = LINE[LINE.length - 1]!;

  return (
    <svg
      viewBox="0 0 460 320"
      role="img"
      aria-label="Illustration of a rising price chart"
      className={className}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: "var(--brand)", stopOpacity: 0.28 }} />
          <stop offset="100%" style={{ stopColor: "var(--brand)", stopOpacity: 0 }} />
        </linearGradient>
      </defs>

      <rect
        x="1"
        y="1"
        width="458"
        height="318"
        rx="20"
        className="fill-surface-raised stroke-border"
        strokeWidth="2"
      />

      {GRID_Y.map((y) => (
        <line
          key={y}
          x1="24"
          x2="436"
          y1={y}
          y2={y}
          className="stroke-border"
          strokeWidth="1.5"
          strokeDasharray="4 6"
        />
      ))}

      {VOLUME.map((height, index) => (
        <rect
          key={index}
          x={LINE[index]![0] - 9}
          y={292 - height}
          width="18"
          height={height}
          rx="4"
          className="fill-brand"
          opacity="0.22"
        />
      ))}

      <path d={areaPath} fill={`url(#${gradientId})`} />
      <polyline
        points={linePoints}
        fill="none"
        className="stroke-brand"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <circle cx={endX} cy={endY} r="13" className="fill-brand" opacity="0.2" />
      <circle
        cx={endX}
        cy={endY}
        r="6.5"
        className="fill-brand stroke-surface-raised"
        strokeWidth="3"
      />
    </svg>
  );
}

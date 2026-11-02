"use client";

import clsx from "clsx";
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { formatMoney, formatPercent } from "@/lib/format";
import { Change } from "@/components/ui/Change";

// Illustrative data only, clearly labelled "Sample data" in the UI. It is not real market data.
const POINTS = [
  { label: "Jan", value: 118.2 },
  { label: "Feb", value: 121.9 },
  { label: "Mar", value: 119.4 },
  { label: "Apr", value: 128.7 },
  { label: "May", value: 126.1 },
  { label: "Jun", value: 135.9 },
  { label: "Jul", value: 133.2 },
  { label: "Aug", value: 142.8 },
  { label: "Sep", value: 140.5 },
  { label: "Oct", value: 151.3 },
  { label: "Nov", value: 149.8 },
  { label: "Dec", value: 163.4 },
] as const;

const WIDTH = 460;
const HEIGHT = 300;
const PAD_X = 28;
const TOP = 36;
const BOTTOM = 220;
const BASELINE = 284;
const LAST = POINTS.length - 1;
const STEP = (WIDTH - PAD_X * 2) / LAST;

const values = POINTS.map((p) => p.value);
const MIN = Math.min(...values);
const MAX = Math.max(...values);

const xAt = (index: number) => PAD_X + index * STEP;
const yAt = (value: number) => BOTTOM - ((value - MIN) / (MAX - MIN)) * (BOTTOM - TOP);

const coords = POINTS.map((p, i) => [xAt(i), yAt(p.value)] as const);

/** Smooth curve through the points (Catmull-Rom converted to cubic Bezier segments). */
function smoothPath(points: ReadonlyArray<readonly [number, number]>): string {
  const first = points[0]!;
  let d = `M${first[0]},${first[1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(i + 2, points.length - 1)]!;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

const LINE_PATH = smoothPath(coords);
const AREA_PATH = `${LINE_PATH} L${xAt(LAST)},${BASELINE} L${xAt(0)},${BASELINE} Z`;
const GRID_Y = [TOP + 24, TOP + 72, TOP + 120, TOP + 168];
const START = POINTS[0].value;

function pointInfo(index: number) {
  const point = POINTS[index]!;
  const change = ((point.value - START) / START) * 100;
  return { point, change };
}

/**
 * Hero chart: draws itself on load, then lets visitors scrub through the (sample) data with the
 * pointer or the keyboard. It is exposed as a slider so assistive technology announces each value.
 * All entrance motion is CSS and turns off under reduced motion.
 */
export function HeroChart({ className }: { className?: string }) {
  const gradientId = useId();
  const [active, setActive] = useState<number | null>(null);
  const [hovering, setHovering] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);

  const idle = active === null;
  const current = active ?? LAST;
  const { point, change } = pointInfo(current);
  const x = xAt(current);
  const y = yAt(point.value);

  const onKeyDown = (event: KeyboardEvent) => {
    const keys: Record<string, number> = {
      ArrowRight: Math.min(current + 1, LAST),
      ArrowUp: Math.min(current + 1, LAST),
      ArrowLeft: Math.max(current - 1, 0),
      ArrowDown: Math.max(current - 1, 0),
      Home: 0,
      End: LAST,
    };
    const next = keys[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setActive(next);
  };

  const onPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const viewX = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const index = Math.round((viewX - PAD_X) / STEP);
    setHovering(true);
    setActive(Math.min(Math.max(index, 0), LAST));
  };

  return (
    <figure
      className={`border-border bg-surface-raised relative rounded-3xl border p-4 shadow-xl sm:p-5 ${className ?? ""}`}
    >
      <figcaption className="flex items-end justify-between gap-4 px-1 pb-3">
        <div>
          <p className="text-fg-muted text-xs font-semibold tracking-wide uppercase">
            Sample data &middot; {point.label}
          </p>
          <p className="text-2xl font-semibold tabular-nums sm:text-3xl">
            {formatMoney(point.value)}
          </p>
        </div>
        <Change value={change} className="text-base sm:text-lg" />
      </figcaption>

      <div
        role="slider"
        tabIndex={0}
        aria-label="Sample price chart. Use the arrow keys to move through the year."
        aria-orientation="horizontal"
        aria-valuemin={0}
        aria-valuemax={LAST}
        aria-valuenow={current}
        aria-valuetext={`${point.label}: ${formatMoney(point.value)}, ${formatPercent(change, { signed: true })} since January`}
        onKeyDown={onKeyDown}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={() => {
          setHovering(false);
          if (document.activeElement !== sliderRef.current) setActive(null);
        }}
        onBlur={() => {
          if (!hovering) setActive(null);
        }}
        ref={sliderRef}
        className="cursor-crosshair touch-pan-y rounded-2xl"
      >
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true" className="h-auto w-full">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: "var(--brand)", stopOpacity: 0.32 }} />
              <stop offset="100%" style={{ stopColor: "var(--brand)", stopOpacity: 0 }} />
            </linearGradient>
          </defs>

          {GRID_Y.map((gy) => (
            <line
              key={gy}
              x1={PAD_X - 8}
              x2={WIDTH - PAD_X + 8}
              y1={gy}
              y2={gy}
              className="stroke-border"
              strokeWidth="1.5"
              strokeDasharray="4 6"
            />
          ))}

          {POINTS.map((p, i) => (
            <rect
              key={p.label}
              x={xAt(i) - 7}
              y={BASELINE - 8 - ((p.value - MIN) / (MAX - MIN)) * 22 - (i % 3) * 5}
              width="14"
              height={8 + ((p.value - MIN) / (MAX - MIN)) * 22 + (i % 3) * 5}
              rx="3"
              className={`animate-rise fill-brand origin-bottom [transform-box:fill-box] ${
                i === current ? "opacity-60" : "opacity-20"
              }`}
              style={{ animationDelay: `${0.5 + i * 0.05}s` }}
            />
          ))}

          <path
            d={AREA_PATH}
            fill={`url(#${gradientId})`}
            className="animate-fade-in"
            style={{ animationDelay: "1.1s" }}
          />
          <path
            d={LINE_PATH}
            pathLength={1}
            fill="none"
            className="animate-draw stroke-brand"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="1"
          />

          <g
            style={{ transform: `translateX(${x}px)` }}
            className="transition-transform duration-200 ease-out"
          >
            <line
              x1="0"
              x2="0"
              y1={TOP - 12}
              y2={BASELINE}
              className="stroke-brand"
              strokeWidth="1.5"
              strokeDasharray="3 5"
              opacity="0.7"
            />
          </g>
          <g
            style={{ transform: `translate(${x}px, ${y}px)` }}
            className="transition-transform duration-200 ease-out"
          >
            {/* The marker blinks softly only while idle; scrubbing keeps it solid and still. */}
            {idle && (
              <circle
                r="14"
                className="animate-ring fill-brand origin-center [transform-box:fill-box]"
              />
            )}
            <circle
              r="6.5"
              className={clsx("fill-brand stroke-surface-raised", idle && "animate-blink")}
              strokeWidth="3"
            />
          </g>
        </svg>
      </div>
    </figure>
  );
}

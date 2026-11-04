"use client";

import clsx from "clsx";
import { useState, type ReactNode } from "react";
import { Change } from "@/components/ui/Change";
import { IconButton } from "@/components/ui/IconButton";
import { PauseIcon, PlayIcon } from "@/components/ui/icons";

export interface TickerItem {
  /** Unique within the ticker. */
  symbol: string;
  /** Already formatted for display, for example "$98,120". */
  price: string;
  /** Percent points (5.76 means 5.76%), or null when not known. */
  change: string | null;
}

export interface TickerProps {
  /** The accessible name of the region. */
  label: string;
  /** Visible lead-in before the quotes: a short caption, or a data credit line. Styled by the caller. */
  lead: ReactNode;
  items: readonly TickerItem[];
  /** The pause button's names, for example "Pause prices" and "Play prices". */
  pauseLabel: string;
  playLabel: string;
}

function Items({ items, copy }: { items: readonly TickerItem[]; copy?: boolean }) {
  return (
    <ul
      aria-hidden={copy || undefined}
      className={clsx("flex shrink-0 items-center gap-8 pr-8", copy && "motion-reduce:hidden")}
    >
      {items.map(({ symbol, price, change }) => (
        <li key={symbol} className="flex items-baseline gap-2 whitespace-nowrap tabular-nums">
          <span className="font-semibold">{symbol}</span>
          <span>{price}</span>
          {change !== null && <Change value={change} className="text-sm" />}
        </li>
      ))}
    </ul>
  );
}

/**
 * A slow marquee of quotes. It has a pause button (WCAG 2.2.2), also pauses on hover and keyboard
 * focus, and does not move at all under reduced motion (the list becomes scrollable).
 */
export function Ticker({ label, lead, items, pauseLabel, playLabel }: TickerProps) {
  const [paused, setPaused] = useState(false);

  return (
    <section aria-label={label} className="border-border bg-surface-raised/60 border-y">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 sm:flex-nowrap sm:px-6 lg:px-8">
        <div className="shrink-0">{lead}</div>
        <div className="min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)] motion-reduce:overflow-x-auto">
          <div
            className={clsx(
              "motion-safe:animate-marquee flex w-max focus-within:[animation-play-state:paused] hover:[animation-play-state:paused]",
              paused && "[animation-play-state:paused]",
            )}
          >
            <Items items={items} />
            <Items items={items} copy />
          </div>
        </div>
        <IconButton
          label={paused ? playLabel : pauseLabel}
          size="sm"
          variant="ghost"
          onClick={() => setPaused((value) => !value)}
          className="motion-reduce:hidden"
        >
          {paused ? <PlayIcon /> : <PauseIcon />}
        </IconButton>
      </div>
    </section>
  );
}

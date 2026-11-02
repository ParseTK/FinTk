"use client";

import clsx from "clsx";
import { useState } from "react";
import { formatMoney } from "@/lib/format";
import { PauseIcon, PlayIcon } from "@/components/ui/icons";
import { Change } from "@/components/ui/Change";
import { IconButton } from "@/components/ui/IconButton";

// Fictional companies with made-up numbers, so no invented price is ever attached to a real firm.
const SAMPLE = [
  { symbol: "ACME", price: "128.40", change: "1.24" },
  { symbol: "GLBX", price: "54.12", change: "-0.62" },
  { symbol: "NOVA", price: "312.80", change: "2.07" },
  { symbol: "ORBT", price: "18.95", change: "-1.38" },
  { symbol: "PLTN", price: "76.30", change: "0.41" },
  { symbol: "QUBE", price: "204.15", change: "3.12" },
  { symbol: "RIVA", price: "39.70", change: "-0.09" },
  { symbol: "SOLR", price: "92.55", change: "1.86" },
] as const;

function Items({ copy }: { copy?: boolean }) {
  return (
    <ul
      aria-hidden={copy || undefined}
      className={clsx("flex shrink-0 items-center gap-8 pr-8", copy && "motion-reduce:hidden")}
    >
      {SAMPLE.map(({ symbol, price, change }) => (
        <li key={symbol} className="flex items-baseline gap-2 whitespace-nowrap tabular-nums">
          <span className="font-semibold">{symbol}</span>
          <span>{formatMoney(price)}</span>
          <Change value={change} className="text-sm" />
        </li>
      ))}
    </ul>
  );
}

/**
 * A slow marquee of sample quotes. It has a pause button (WCAG 2.2.2), also pauses on hover and
 * keyboard focus, and does not move at all under reduced motion (the list becomes scrollable).
 */
export function MarketTicker() {
  const [paused, setPaused] = useState(false);

  return (
    <section
      aria-label="Sample market snapshot with fictional companies"
      className="border-border bg-surface-raised/60 border-y"
    >
      <div className="flex items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <p className="text-fg-muted shrink-0 text-xs font-semibold tracking-wide uppercase">
          Sample data
        </p>
        <div className="min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)] motion-reduce:overflow-x-auto">
          <div
            className={clsx(
              "motion-safe:animate-marquee flex w-max focus-within:[animation-play-state:paused] hover:[animation-play-state:paused]",
              paused && "[animation-play-state:paused]",
            )}
          >
            <Items />
            <Items copy />
          </div>
        </div>
        <IconButton
          label={paused ? "Play sample ticker" : "Pause sample ticker"}
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

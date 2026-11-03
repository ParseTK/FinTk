"use client";

import clsx from "clsx";
import Link from "next/link";
import { useId, useState } from "react";
import { ChevronDownIcon } from "@/components/ui/icons";
import { formatMoney, formatPrice, formatQuote, formatShares, PLACEHOLDER } from "@/lib/format";
import { GainChip } from "./GainChip";
import { PurchaseItem } from "./PurchaseItem";
import type { Holding, Lot } from "./types";

/**
 * One holding as a card that is collapsed by default, so a long portfolio stays short on a phone.
 * The header (symbol, what it is worth, the gain) is the whole button; opening it shows the
 * figures behind it and this holding's purchases, which can be edited or deleted right there.
 *
 * Without a price (or with values switched off) the header shows what was paid instead.
 */
export function HoldingCard({
  holding,
  lots,
  csrfToken,
  showValue,
  color,
}: {
  holding: Holding;
  lots: Lot[];
  csrfToken: string;
  showValue: boolean;
  /** The color of this company's slice in the allocation bar, as a dot beside its name. */
  color?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const bodyId = `${id}-body`;
  const valuation = showValue ? holding.valuation : null;

  return (
    <article className="border-border bg-surface rounded-xl border">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-start justify-between gap-3 rounded-xl p-4 text-left"
        >
          <span className="flex min-w-0 items-start gap-2.5">
            <span
              aria-hidden="true"
              className="mt-2 size-2.5 shrink-0 rounded-full"
              style={{ background: color ?? "var(--border-strong)" }}
            />
            <span className="min-w-0">
              <span className="block text-lg font-semibold">{holding.symbol}</span>
              {holding.name && (
                <span className="text-fg-muted block truncate text-sm">{holding.name}</span>
              )}
            </span>
          </span>
          <span className="flex shrink-0 items-start gap-2">
            <span className="block text-right">
              {valuation ? (
                <>
                  <span className="block text-lg font-semibold tabular-nums">
                    {formatMoney(valuation.market_value)}
                  </span>
                  <GainChip
                    gain={valuation.gain}
                    percent={valuation.gain_percent}
                    size="sm"
                    className="mt-1 -mr-2"
                  />
                </>
              ) : (
                <>
                  <span className="block text-lg font-semibold tabular-nums">
                    {formatMoney(holding.cost_basis)}
                  </span>
                  <span className="text-fg-muted block text-sm">paid</span>
                </>
              )}
            </span>
            <ChevronDownIcon
              className={clsx(
                "text-fg-muted mt-1 size-5 shrink-0 motion-safe:transition-transform motion-safe:duration-200",
                open && "rotate-180",
              )}
            />
          </span>
        </button>
      </h3>

      <div
        id={bodyId}
        inert={!open}
        className={clsx(
          "grid motion-safe:transition-[grid-template-rows] motion-safe:duration-300",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="border-border space-y-4 border-t p-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Fact term="Shares" value={formatShares(holding.shares)} />
              <Fact term="Average cost" value={formatPrice(holding.average_cost)} />
              <Fact term="Total paid" value={formatMoney(holding.cost_basis)} />
              <Fact
                term="Latest price"
                value={valuation ? formatQuote(valuation.price) : PLACEHOLDER}
              />
            </dl>
            <Link
              href={`/company/${encodeURIComponent(holding.symbol)}`}
              className="text-brand inline-block text-sm font-medium underline underline-offset-2"
            >
              View {holding.symbol} company page
            </Link>
            <div>
              <h4 className="text-fg-muted text-sm font-semibold">
                {lots.length === 1 ? "Record" : `Records (${lots.length})`}
              </h4>
              <ul className="divide-border divide-y">
                {lots.map((lot) => (
                  <PurchaseItem key={lot.id} lot={lot} csrfToken={csrfToken} />
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function Fact({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="text-fg-muted">{term}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

"use client";

import clsx from "clsx";
import Link from "next/link";
import { useId, useState, type MouseEvent } from "react";
import { ChevronDownIcon } from "@/components/ui/icons";
import { formatMoney, formatPrice, formatQuote, formatShares } from "@/lib/format";
import { GainChip } from "./GainChip";
import { PurchaseItem } from "./PurchaseItem";
import type { Holding, Lot } from "./types";

/**
 * One holding in the table: a row that opens to show that company's purchases, which can be edited
 * or deleted there. Clicking anywhere on the row opens it; the company name is a real button, so
 * the keyboard and screen readers get the same thing.
 */
export function HoldingRow({
  holding,
  lots,
  csrfToken,
  valued,
  color,
  columns,
}: {
  holding: Holding;
  lots: Lot[];
  csrfToken: string;
  /** Whether the price, value and gain columns are shown. */
  valued: boolean;
  /** The color of this company's slice in the allocation bar, as a dot beside its name. */
  color?: string;
  columns: number;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const detailId = `${id}-detail`;
  const valuation = valued ? holding.valuation : null;

  // A click on the row opens it, unless it landed on something interactive inside.
  const onRowClick = (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest("a, button, input")) return;
    setOpen((value) => !value);
  };

  return (
    <>
      <tr
        onClick={onRowClick}
        className={clsx(
          "border-border cursor-pointer border-b transition-colors",
          "hover:bg-[color-mix(in_srgb,var(--fg)_4%,transparent)]",
          open && "bg-[color-mix(in_srgb,var(--fg)_4%,transparent)]",
        )}
      >
        <th scope="row" className="py-3.5 pr-4 pl-1 font-normal">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={detailId}
            onClick={() => setOpen((value) => !value)}
            className="flex items-center gap-3 rounded-md text-left"
          >
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: color ?? "var(--border-strong)" }}
            />
            <span>
              <span className="block text-base font-semibold">{holding.symbol}</span>
              {holding.name && <span className="text-fg-muted block text-sm">{holding.name}</span>}
            </span>
            <ChevronDownIcon
              className={clsx(
                "text-fg-muted size-4 shrink-0 motion-safe:transition-transform motion-safe:duration-200",
                open && "rotate-180",
              )}
            />
          </button>
        </th>
        <td className="px-2 py-3.5 text-right tabular-nums">{formatShares(holding.shares)}</td>
        <td className="px-2 py-3.5 text-right tabular-nums">{formatPrice(holding.average_cost)}</td>
        <td className="px-2 py-3.5 text-right tabular-nums">{formatMoney(holding.cost_basis)}</td>
        {valued && (
          <>
            <td className="px-2 py-3.5 text-right tabular-nums">
              {valuation ? formatQuote(valuation.price) : "—"}
            </td>
            <td className="px-2 py-3.5 text-right font-semibold tabular-nums">
              {valuation ? formatMoney(valuation.market_value) : "—"}
            </td>
            <td className="py-3.5 pr-1 pl-2 text-right">
              {valuation ? (
                <GainChip gain={valuation.gain} percent={valuation.gain_percent} size="sm" />
              ) : (
                "—"
              )}
            </td>
          </>
        )}
      </tr>
      <tr>
        <td colSpan={columns} className="p-0">
          <div
            id={detailId}
            inert={!open}
            className={clsx(
              "grid motion-safe:transition-[grid-template-rows] motion-safe:duration-300",
              open ? "border-border grid-rows-[1fr] border-b" : "grid-rows-[0fr]",
            )}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="space-y-3 px-1 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h4 className="text-fg-muted text-sm font-semibold">
                    {lots.length === 1 ? "Record" : `Records (${lots.length})`}
                  </h4>
                  <Link
                    href={`/company/${encodeURIComponent(holding.symbol)}`}
                    className="text-brand text-sm font-medium underline underline-offset-2"
                  >
                    View {holding.symbol} company page
                  </Link>
                </div>
                <ul className="divide-border divide-y">
                  {lots.map((lot) => (
                    <PurchaseItem key={lot.id} lot={lot} csrfToken={csrfToken} />
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </td>
      </tr>
    </>
  );
}

"use client";

import { useDeferredValue, useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Field";
import { SearchIcon } from "@/components/ui/icons";
import { ExpandableHoldingsTable } from "./ExpandableHoldingsTable";
import { HoldingsCards } from "./HoldingsCards";
import {
  defaultSort,
  filterHoldings,
  PAGE_SIZE,
  sortHoldings,
  sortOptions,
  TOOLBAR_MIN,
  type SortKey,
} from "./holdingsView";
import type { Lot, Portfolio } from "./types";

/**
 * The holdings, made for a portfolio of any size: search by ticker or name, choose the order, and
 * see them a page at a time, so a hundred companies is a short page with a "Show more", not a
 * wall. Phones get collapsed cards, wider screens a table; both show the same list.
 *
 * Small portfolios get no toolbar: with a handful of holdings it would only be clutter.
 */
export function HoldingsExplorer({
  portfolio,
  lots,
  csrfToken,
  showValue,
  colors,
}: {
  portfolio: Portfolio;
  lots: Lot[];
  csrfToken: string;
  showValue: boolean;
  colors: Record<string, string>;
}) {
  const valued = showValue && portfolio.holdings.some((holding) => holding.valuation);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>(defaultSort(valued));
  const [shown, setShown] = useState(PAGE_SIZE);
  const searchId = useId();
  const sortId = useId();

  // Typing stays instant; the list catches up a moment later.
  const deferredQuery = useDeferredValue(query);
  const matching = sortHoldings(filterHoldings(portfolio.holdings, deferredQuery), sort);
  const visible = matching.slice(0, shown);
  const total = portfolio.holdings.length;
  const searching = deferredQuery.trim() !== "";
  const showToolbar = total >= TOOLBAR_MIN;
  const view = { ...portfolio, holdings: visible };

  const status = searching
    ? matching.length === 0
      ? `No holdings match "${deferredQuery.trim()}".`
      : `${matching.length} of ${total} holdings match "${deferredQuery.trim()}"${visible.length < matching.length ? `, showing ${visible.length}` : ""}.`
    : visible.length < total
      ? `Showing ${visible.length} of ${total} holdings.`
      : `${total} holdings.`;

  return (
    <div className="space-y-4">
      {showToolbar && (
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          <div className="relative min-w-56 flex-1">
            <Label htmlFor={searchId} className="sr-only">
              Search your holdings by ticker or company name
            </Label>
            <SearchIcon className="text-fg-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setShown(PAGE_SIZE);
              }}
              placeholder="Search by ticker or company"
              autoComplete="off"
              spellCheck={false}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor={sortId} className="text-fg-muted whitespace-nowrap">
              Sort by
            </Label>
            <select
              id={sortId}
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as SortKey);
                setShown(PAGE_SIZE);
              }}
              className="border-border-strong bg-surface text-fg rounded-lg border px-3 py-2"
            >
              {sortOptions(valued).map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Always present, so a screen reader hears the count change as someone types. */}
      <p role="status" aria-live="polite" className="text-fg-muted text-sm">
        {showToolbar ? status : ""}
      </p>

      {matching.length === 0 ? (
        <Card className="space-y-3 text-center">
          <p className="text-fg-muted">Nothing matches that search.</p>
          <div>
            <Button variant="secondary" size="sm" onClick={() => setQuery("")}>
              Clear search
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <div className="md:hidden">
            <HoldingsCards
              portfolio={view}
              lots={lots}
              csrfToken={csrfToken}
              showValue={showValue}
              colors={colors}
            />
          </div>
          <Card className="hidden rounded-2xl p-2 sm:p-4 md:block">
            <ExpandableHoldingsTable
              portfolio={view}
              lots={lots}
              csrfToken={csrfToken}
              showValue={showValue}
              colors={colors}
            />
          </Card>
        </>
      )}

      {visible.length < matching.length && (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => setShown((count) => count + PAGE_SIZE)}>
            Show {Math.min(PAGE_SIZE, matching.length - visible.length)} more
          </Button>
        </div>
      )}
    </div>
  );
}

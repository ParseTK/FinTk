"use client";

import { usePortfolio } from "./PortfolioProvider";

export function PortfolioToggleButton({ symbol }: { symbol: string }) {
  const { has, add, remove } = usePortfolio();
  const inPortfolio = has(symbol);

  return (
    <button
      type="button"
      aria-pressed={inPortfolio}
      aria-label={`${inPortfolio ? "Remove" : "Add"} ${symbol} ${inPortfolio ? "from" : "to"} portfolio`}
      onClick={() => (inPortfolio ? remove(symbol) : add(symbol))}
      className="bg-brand text-on-accent aria-pressed:bg-fg-muted rounded-lg px-6 py-2 font-medium transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {inPortfolio ? "In portfolio" : "Add to portfolio"}
    </button>
  );
}

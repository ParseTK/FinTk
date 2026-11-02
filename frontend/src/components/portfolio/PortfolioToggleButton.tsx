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
      className="bg-brand-dark focus-visible:outline-brand rounded-lg px-6 py-2 font-medium text-white transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 aria-pressed:bg-gray-700"
    >
      {inPortfolio ? "In portfolio" : "Add to portfolio"}
    </button>
  );
}

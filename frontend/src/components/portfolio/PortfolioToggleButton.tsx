"use client";

import { Button } from "../ui/Button";
import { usePortfolio } from "./PortfolioProvider";

export function PortfolioToggleButton({ symbol }: { symbol: string }) {
  const { has, add, remove } = usePortfolio();
  const inPortfolio = has(symbol);

  return (
    <Button
      variant={inPortfolio ? "secondary" : "primary"}
      aria-pressed={inPortfolio}
      aria-label={`${inPortfolio ? "Remove" : "Add"} ${symbol} ${inPortfolio ? "from" : "to"} portfolio`}
      onClick={() => (inPortfolio ? remove(symbol) : add(symbol))}
    >
      {inPortfolio && <span aria-hidden="true">&#10003;</span>}
      {inPortfolio ? "In portfolio" : "Add to portfolio"}
    </Button>
  );
}

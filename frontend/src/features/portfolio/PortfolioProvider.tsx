"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

interface PortfolioContextValue {
  symbols: string[];
  has: (symbol: string) => boolean;
  add: (symbol: string) => void;
  remove: (symbol: string) => void;
}

const PortfolioContext = createContext<PortfolioContextValue | null>(null);

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const [symbols, setSymbols] = useState<string[]>([]);

  const add = useCallback(
    (symbol: string) =>
      setSymbols((current) => (current.includes(symbol) ? current : [...current, symbol])),
    [],
  );
  const remove = useCallback(
    (symbol: string) => setSymbols((current) => current.filter((s) => s !== symbol)),
    [],
  );

  const value = useMemo(
    () => ({ symbols, has: (symbol: string) => symbols.includes(symbol), add, remove }),
    [symbols, add, remove],
  );

  return <PortfolioContext value={value}>{children}</PortfolioContext>;
}

export function usePortfolio() {
  const context = useContext(PortfolioContext);
  if (!context) throw new Error("usePortfolio must be used within PortfolioProvider");
  return context;
}

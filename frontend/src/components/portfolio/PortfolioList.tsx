"use client";

import Link from "next/link";
import { usePortfolio } from "./PortfolioProvider";

export function PortfolioList() {
  const { symbols, remove } = usePortfolio();

  return (
    <section aria-labelledby="portfolio-heading" className="mx-auto max-w-5xl px-6 py-6">
      <h2 id="portfolio-heading" className="mb-4 text-center text-3xl font-semibold">
        My portfolio
      </h2>
      {symbols.length === 0 ? (
        <p className="text-fg-muted text-center text-lg">Your portfolio is empty.</p>
      ) : (
        <ul className="flex flex-wrap justify-center gap-4">
          {symbols.map((symbol) => (
            <li key={symbol} className="flex items-center gap-3 rounded-lg p-4 shadow">
              <Link
                href={`/company/${encodeURIComponent(symbol)}`}
                className="text-lg font-bold underline-offset-2 hover:underline"
              >
                {symbol}
              </Link>
              <button
                type="button"
                onClick={() => remove(symbol)}
                aria-label={`Remove ${symbol} from portfolio`}
                className="border-loss text-loss hover:bg-loss hover:text-on-accent focus-visible:outline-loss rounded-md border-2 px-3 py-1 focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

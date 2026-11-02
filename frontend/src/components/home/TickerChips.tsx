import Link from "next/link";

const EXAMPLES = [
  { symbol: "AAPL", name: "Apple" },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "NVDA", name: "NVIDIA" },
  { symbol: "KO", name: "Coca-Cola" },
] as const;

/** One-click examples, so a first-time visitor can see a company page without typing. */
export function TickerChips() {
  return (
    <nav aria-label="Example companies" className="flex flex-wrap items-center gap-2">
      <span className="text-fg-muted text-sm">Try:</span>
      <ul className="flex flex-wrap gap-2">
        {EXAMPLES.map(({ symbol, name }) => (
          <li key={symbol}>
            <Link
              href={`/company/${symbol}`}
              aria-label={`${name} (${symbol})`}
              className="border-border-strong hover:border-brand hover:text-brand inline-block rounded-full border px-3 py-1 text-sm font-semibold transition duration-150 motion-safe:hover:-translate-y-0.5"
            >
              {symbol}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

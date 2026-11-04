import { formatMoney } from "@/lib/format";
import { Ticker } from "@/components/ui/Ticker";

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

/** The sample strip of fictional quotes (kept until the stock-side landing page is retired). */
export function MarketTicker() {
  return (
    <Ticker
      label="Sample market snapshot with fictional companies"
      lead={
        <span className="text-fg-muted text-xs font-semibold tracking-wide uppercase">
          Sample data
        </span>
      }
      items={SAMPLE.map(({ symbol, price, change }) => ({
        symbol,
        price: formatMoney(price),
        change,
      }))}
      pauseLabel="Pause sample ticker"
      playLabel="Play sample ticker"
    />
  );
}

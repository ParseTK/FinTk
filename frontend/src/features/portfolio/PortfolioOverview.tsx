import { formatDate, formatMoney } from "@/lib/format";
import { AllocationBar } from "./AllocationBar";
import { computeAllocation, fromCents, toCents } from "./allocation";
import { GainChip } from "./GainChip";
import type { Portfolio } from "./types";

/**
 * A soft light in the card's corner, in the visitor's accent color so the page matches the palette
 * they chose. (Gain and loss keep their own green and red, on the chip, where the color has meaning.)
 */
const GLOW =
  "radial-gradient(60% 90% at 100% 0%, color-mix(in srgb, var(--brand) 18%, transparent), transparent 70%)";

/**
 * The top of the portfolio page: what it is worth as one large figure, the gain beside it, what was
 * paid, and how the money is split. Without prices the large figure is what was paid, and the page
 * says values will appear once prices are available.
 *
 * Values are month-end closing prices, so the card says how recent they are and how many holdings
 * they cover instead of presenting a number that looks live.
 */
export function PortfolioOverview({
  portfolio,
  showValue,
}: {
  portfolio: Portfolio;
  showValue: boolean;
}) {
  const valuation = showValue ? (portfolio.valuation ?? null) : null;
  const allocation = computeAllocation(portfolio.holdings);
  const total = portfolio.holdings.length;
  const partial = valuation !== null && valuation.holdings_valued < total;
  // With only some holdings priced, "paid" must be compared with the same holdings, or a value of
  // three companies would sit beside what was paid for a hundred and read as a huge loss.
  const pricedPaid = fromCents(
    portfolio.holdings.reduce((sum, h) => (h.valuation ? sum + toCents(h.cost_basis) : sum), 0n),
  );
  return (
    <section
      aria-labelledby="overview-heading"
      className="border-border from-surface-raised to-surface relative overflow-clip rounded-2xl border bg-linear-to-br shadow-sm"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: GLOW }}
      />
      <div className="relative space-y-8 p-6 sm:p-8">
        <h2 id="overview-heading" className="sr-only">
          Portfolio overview
        </h2>

        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div className="space-y-2">
            <p className="text-fg-muted text-sm font-medium">
              {valuation
                ? partial
                  ? `Value of ${valuation.holdings_valued} priced ${valuation.holdings_valued === 1 ? "holding" : "holdings"}`
                  : "Portfolio value"
                : "Total paid"}
            </p>
            <p className="text-5xl font-semibold tracking-tight sm:text-6xl">
              {formatMoney(valuation ? valuation.market_value : portfolio.total_cost_basis)}
            </p>
            {valuation && (
              <GainChip gain={valuation.gain} percent={valuation.gain_percent} size="lg" />
            )}
          </div>

          <dl className="flex gap-10 text-sm">
            {valuation && (
              <div>
                <dt className="text-fg-muted">{partial ? "Paid for these" : "Paid"}</dt>
                <dd className="text-xl font-semibold">
                  {formatMoney(partial ? pricedPaid : portfolio.total_cost_basis)}
                </dd>
              </div>
            )}
            {partial && (
              <div>
                <dt className="text-fg-muted">Total paid</dt>
                <dd className="text-xl font-semibold">{formatMoney(portfolio.total_cost_basis)}</dd>
              </div>
            )}
            <div>
              <dt className="text-fg-muted">Companies</dt>
              <dd className="text-xl font-semibold">{total}</dd>
            </div>
          </dl>
        </div>

        {allocation && total > 1 && <AllocationBar allocation={allocation} />}

        <p className="text-fg-muted text-xs">
          {valuation
            ? `Month-end closing prices from ${valuation.source}, the latest being ${formatDate(valuation.as_of, "month-year")}, so values can trail the market by up to a month. Gains are price changes and do not include dividends.${partial ? ` Value and gain cover ${valuation.holdings_valued} of your ${total} holdings: the rest have no price yet.` : ""}`
            : "Values will appear here once prices are available for your holdings."}
        </p>
      </div>
    </section>
  );
}

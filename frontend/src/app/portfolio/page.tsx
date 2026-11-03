import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { getSession } from "@/features/auth";
import {
  AddPurchaseForm,
  AddPurchasePanel,
  allocationColors,
  ExpandableHoldingsTable,
  getLots,
  getPortfolio,
  HoldingsCards,
  HoldingsTable,
  PortfolioOverview,
  PortfolioSummary,
  PurchasesSection,
} from "@/features/portfolio";
import { isEnabled } from "@/lib/flags";

export const metadata: Metadata = { title: "Portfolio", robots: { index: false } };

export default async function PortfolioPage() {
  const { user, csrfToken } = await getSession();
  if (!user || !csrfToken) redirect(`/sign-in?next=${encodeURIComponent("/portfolio")}`);
  const [portfolio, lots] = await Promise.all([getPortfolio(), getLots()]);
  const showValue = isEnabled("valuation");
  const v2 = isEnabled("portfolio_v2");

  const intro = (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Portfolio</h1>
      <p className="text-fg-muted">
        Keep a record of what you bought and what you paid. Amounts are in US dollars.
        {showValue
          ? " Values use month-end closing prices where we have them."
          : " They show what you paid; current values will appear once price data is added."}
      </p>
    </>
  );

  return (
    <Container size={showValue || v2 ? "default" : "narrow"} className="py-8">
      <div className={v2 ? "space-y-8" : "space-y-6"}>
        {v2 ? (
          <AddPurchasePanel csrfToken={csrfToken} heading={intro} />
        ) : (
          <header className="space-y-2">{intro}</header>
        )}

        {portfolio === null || lots === null ? (
          <Alert variant="error" title="We could not load your portfolio">
            Please try again in a moment.
          </Alert>
        ) : v2 ? (
          portfolio.holdings.length > 0 && (
            <>
              <PortfolioOverview portfolio={portfolio} showValue={showValue} />
              <section aria-labelledby="holdings-heading" className="space-y-4">
                <h2 id="holdings-heading" className="text-xl font-semibold">
                  Holdings
                </h2>
                {/* Phones get collapsed cards, wider screens a table whose rows open. Either way
                    a company's records live inside it, so there is no separate list to scroll. */}
                <div className="md:hidden">
                  <HoldingsCards
                    portfolio={portfolio}
                    lots={lots}
                    csrfToken={csrfToken}
                    showValue={showValue}
                    colors={allocationColors(portfolio.holdings)}
                  />
                </div>
                <Card className="hidden rounded-2xl p-2 sm:p-4 md:block">
                  <ExpandableHoldingsTable
                    portfolio={portfolio}
                    lots={lots}
                    csrfToken={csrfToken}
                    showValue={showValue}
                    colors={allocationColors(portfolio.holdings)}
                  />
                </Card>
              </section>
            </>
          )
        ) : (
          <>
            {portfolio.holdings.length > 0 && (
              <Card as="section" aria-labelledby="holdings-heading" className="space-y-3">
                <h2 id="holdings-heading" className="text-xl font-semibold">
                  Holdings
                </h2>
                {showValue && <PortfolioSummary portfolio={portfolio} />}
                <HoldingsTable portfolio={portfolio} showValue={showValue} />
              </Card>
            )}

            <Card>
              <AddPurchaseForm csrfToken={csrfToken} />
            </Card>

            {portfolio.holdings.length > 0 && (
              <Card as="section" aria-labelledby="purchases-heading" className="space-y-3">
                <h2 id="purchases-heading" className="text-xl font-semibold">
                  Your purchases
                </h2>
                <PurchasesSection holdings={portfolio.holdings} lots={lots} csrfToken={csrfToken} />
              </Card>
            )}
          </>
        )}
      </div>
    </Container>
  );
}

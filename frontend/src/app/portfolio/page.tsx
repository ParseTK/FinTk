import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { getSession } from "@/features/auth";
import {
  AddPurchaseForm,
  AddPurchasePanel,
  getLots,
  getPortfolio,
  HoldingsTable,
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
      <h1 className="text-3xl font-bold">Portfolio</h1>
      <p className="text-fg-muted">
        Record what you bought and what you paid. Average cost is worked out from your purchases.
        Amounts are in US dollars.
        {showValue
          ? " Values use month-end closing prices where we have them."
          : " They show what you paid; current values will appear once price data is added."}
      </p>
    </>
  );

  return (
    <Container size={showValue || v2 ? "default" : "narrow"} className="py-8">
      <div className="space-y-6">
        {v2 ? (
          <AddPurchasePanel csrfToken={csrfToken} heading={intro} />
        ) : (
          <header className="space-y-2">{intro}</header>
        )}

        {portfolio === null || lots === null ? (
          <Alert variant="error" title="We could not load your portfolio">
            Please try again in a moment.
          </Alert>
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

            {!v2 && (
              <Card>
                <AddPurchaseForm csrfToken={csrfToken} />
              </Card>
            )}

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

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { getSession } from "@/features/auth";
import {
  AddPurchaseForm,
  getLots,
  getPortfolio,
  HoldingsTable,
  PurchasesSection,
} from "@/features/portfolio";

export const metadata: Metadata = { title: "Portfolio", robots: { index: false } };

export default async function PortfolioPage() {
  const { user, csrfToken } = await getSession();
  if (!user || !csrfToken) redirect(`/sign-in?next=${encodeURIComponent("/portfolio")}`);
  const [portfolio, lots] = await Promise.all([getPortfolio(), getLots()]);

  return (
    <Container size="narrow" className="py-8">
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">Portfolio</h1>
          <p className="text-fg-muted">
            Record what you bought and what you paid. Average cost is worked out from your
            purchases. Amounts are in US dollars and show what you paid; current values will appear
            once price data is added.
          </p>
        </header>

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
                <HoldingsTable portfolio={portfolio} />
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

import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { DataCredit } from "@/components/ui/DataCredit";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/LinkButton";
import type { Portfolio } from "./data";
import { HoldingCards } from "./HoldingCards";
import { HoldingsTable } from "./HoldingsTable";
import { PortfolioSummary } from "./PortfolioSummary";

/**
 * The portfolio page body: the provider's credit, a summary, then each coin held with its value
 * and, where a cost was entered, its gain or loss (a table on large screens, cards below that).
 * Values are not stored anywhere: they were worked out from today's prices when this page was
 * built, and the credit sits above them. Each part is its own file; this only decides which to show.
 */
export function PortfolioBody({
  portfolio,
  csrfToken,
}: {
  portfolio: Portfolio;
  csrfToken: string;
}) {
  const { holdings } = portfolio;

  if (holdings.length === 0) {
    return (
      <Card className="rounded-2xl">
        <EmptyState
          title="You have not added any coins yet"
          description="Open a coin's page and enter how much you hold. Use the search box at the top to find one."
          action={
            <LinkButton href="/crypto/search" variant="secondary">
              Search coins
            </LinkButton>
          }
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <DataCredit
        text={portfolio.attribution.text}
        href={portfolio.attribution.url}
        linkText="CoinMarketCap.com"
      />
      {!portfolio.prices_available && (
        <Alert title="Prices are not available right now">
          Your holdings are listed below without values. Try again in a moment.
        </Alert>
      )}
      <PortfolioSummary portfolio={portfolio} />
      <HoldingsTable holdings={holdings} csrfToken={csrfToken} />
      <HoldingCards holdings={holdings} csrfToken={csrfToken} />
    </div>
  );
}

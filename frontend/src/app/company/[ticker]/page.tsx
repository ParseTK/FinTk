import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import {
  FilingsList,
  FinancialsTable,
  getCompanyProfile,
  getKeyFilings,
  getFinancials,
} from "@/features/market-data";
import { getWatchlistState, WatchlistToggle } from "@/features/watchlist";
import { isEnabled } from "@/lib/flags";
import { formatFiscalYearEnd } from "@/lib/format";

type Props = { params: Promise<{ ticker: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticker } = await params;
  return { title: ticker.toUpperCase() };
}

export default async function CompanyPage({ params }: Props) {
  const { ticker } = await params;
  const company = await getCompanyProfile(ticker);
  if (!company) notFound();
  const [financials, filings, watch] = await Promise.all([
    getFinancials(company.ticker),
    getKeyFilings(company.ticker),
    isEnabled("auth") ? getWatchlistState() : undefined,
  ]);

  const facts = [
    ["Industry", company.industry],
    ["Exchange", company.exchange],
    ["Filer type", company.category],
    ["Fiscal year ends", formatFiscalYearEnd(company.fiscal_year_end)],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  return (
    <Container size="narrow" className="py-8">
      <article className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold">
            {company.name} <span className="text-fg-muted font-normal">({company.ticker})</span>
          </h1>
          {company.industry && <p className="text-fg-muted">{company.industry}</p>}
          {watch && (
            <div className="pt-2">
              <WatchlistToggle
                symbol={company.ticker}
                watched={watch.signedIn && watch.symbols.includes(company.ticker)}
                csrfToken={watch.signedIn ? watch.csrfToken : undefined}
                signInNext={`/company/${encodeURIComponent(company.ticker)}`}
              />
            </div>
          )}
        </header>

        {facts.length > 0 && (
          <Card as="section" aria-labelledby="about-heading" className="space-y-3">
            <h2 id="about-heading" className="text-xl font-semibold">
              About
            </h2>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              {facts.map(([term, value]) => (
                <div key={term}>
                  <dt className="text-fg-muted text-sm">{term}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        )}

        <Card as="section" aria-labelledby="financials-heading" className="space-y-3">
          <h2 id="financials-heading" className="text-xl font-semibold">
            Annual results
          </h2>
          {financials && financials.metrics.length > 0 ? (
            <>
              <FinancialsTable financials={financials} />
              <p className="text-fg-muted text-sm">Source: {financials.source}. Amounts in USD.</p>
            </>
          ) : (
            <p className="text-fg-muted">No annual financial data is available for this company.</p>
          )}
        </Card>

        <Card as="section" aria-labelledby="filings-heading" className="space-y-3">
          <h2 id="filings-heading" className="text-xl font-semibold">
            Recent filings
          </h2>
          {filings.length > 0 ? (
            <FilingsList filings={filings} />
          ) : (
            <p className="text-fg-muted">No recent filings found.</p>
          )}
        </Card>
      </article>
    </Container>
  );
}

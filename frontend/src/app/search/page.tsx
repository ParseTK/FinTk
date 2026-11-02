import type { Metadata } from "next";
import { CompanyCard } from "@/components/CompanyCard";
import { Container } from "@/components/layout/Container";
import { PortfolioList } from "@/components/portfolio/PortfolioList";
import { SearchForm } from "@/components/SearchForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { searchCompanies } from "@/lib/fmp";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q } = await searchParams;
  const query = (Array.isArray(q) ? q[0] : q) ?? "";
  const results = await searchCompanies(query);

  return (
    <>
      <h1 className="sr-only">Search companies</h1>
      <div className="flex justify-center px-4 py-6 sm:px-6">
        <SearchForm defaultValue={query} />
      </div>
      <PortfolioList />
      {query && (
        <section aria-labelledby="results-heading" className="pb-12">
          <Container className="space-y-3">
            <h2 id="results-heading" className="sr-only">
              Search results
            </h2>
            <p role="status" className="text-fg-muted text-center">
              {results.length} {results.length === 1 ? "result" : "results"} for &ldquo;{query}
              &rdquo;
            </p>
            {results.length === 0 ? (
              <EmptyState
                title="No companies found"
                description="Check the spelling, or try a ticker symbol."
                headingLevel={3}
              />
            ) : (
              <ul className="space-y-3">
                {results.map((company) => (
                  <CompanyCard key={`${company.symbol}-${company.exchange}`} company={company} />
                ))}
              </ul>
            )}
          </Container>
        </section>
      )}
    </>
  );
}

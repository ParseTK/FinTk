import type { Metadata } from "next";
import { CompanyCard } from "@/features/search";
import { Container } from "@/components/ui/Container";
import { PortfolioList } from "@/features/portfolio";
import { SearchBox } from "@/features/search";
import { EmptyState } from "@/components/ui/EmptyState";
import { searchCompanies } from "@/features/market-data";
import { getWatchlistState } from "@/features/watchlist";
import { isEnabled } from "@/lib/flags";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q } = await searchParams;
  const query = (Array.isArray(q) ? q[0] : q) ?? "";
  const results = await searchCompanies(query);
  // With sign-in on, results carry the real watchlist toggle; off, the original local one.
  const watch = isEnabled("auth") ? await getWatchlistState() : undefined;
  const here = `/search?q=${encodeURIComponent(query)}`;

  return (
    <>
      <h1 className="sr-only">Search companies</h1>
      <div className="flex justify-center px-4 py-6 sm:px-6">
        <SearchBox defaultValue={query} />
      </div>
      {!watch && <PortfolioList />}
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
                {results.map((company, index) => (
                  <CompanyCard
                    key={company.ticker}
                    company={company}
                    index={index}
                    watch={watch}
                    signInNext={here}
                  />
                ))}
              </ul>
            )}
          </Container>
        </section>
      )}
    </>
  );
}

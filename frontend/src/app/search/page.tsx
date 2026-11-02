import type { Metadata } from "next";
import { CompanyCard } from "@/components/CompanyCard";
import { PortfolioList } from "@/components/portfolio/PortfolioList";
import { SearchForm } from "@/components/SearchForm";
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
      <SearchForm defaultValue={query} />
      <PortfolioList />
      {query && (
        <section
          aria-labelledby="results-heading"
          className="mx-auto max-w-5xl space-y-3 px-6 pb-12"
        >
          <h2 id="results-heading" className="sr-only">
            Search results
          </h2>
          <p role="status" className="text-center text-gray-600">
            {results.length} {results.length === 1 ? "result" : "results"} for &ldquo;{query}
            &rdquo;
          </p>
          <ul className="space-y-3">
            {results.map((company) => (
              <CompanyCard key={`${company.symbol}-${company.exchange}`} company={company} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

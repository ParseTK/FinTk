import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { NewsBrowser } from "./NewsBrowser";
import { getCryptoNews } from "./data";

/**
 * The crypto news body. A server component that waits for the announcements itself, so the heading
 * can be shown first (wrap it in Suspense). The two rules that pick the items are printed under the
 * list, so a reader can see why something is here and why something else is not.
 */
export async function CryptoNews() {
  const news = await getCryptoNews();
  if (news === null) {
    return (
      <ErrorState
        title="Crypto news is not available right now"
        description="The official sources could not be reached. Please try again in a moment."
      />
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-fg-muted text-sm">{news.basis}</p>
      {news.unavailable.length > 0 && (
        <Alert title="Some sources are unavailable">
          Could not reach: {news.unavailable.join(", ")}. What is shown below is complete only for
          the other sources.
        </Alert>
      )}
      {news.items.length > 0 ? (
        <NewsBrowser items={news.items} />
      ) : (
        <EmptyState
          title="Nothing to show right now"
          description="No official announcement or listed-company filing matches the rules below at the moment."
        />
      )}
      <details className="text-fg-muted text-sm">
        <summary className="text-fg cursor-pointer font-medium">How items are chosen</summary>
        <div className="mt-2 space-y-2">
          <p>
            Announcements from the SEC, CFTC and Department of Justice are included when their
            headline contains one of these words or phrases: {news.terms.join(", ")}.
          </p>
          <p>
            SEC filings (Form 8-K) are included for these companies, from the last{" "}
            {news.filing_days} days, at most the newest {news.per_company_limit} of each:{" "}
            {news.companies.join(", ")}.
          </p>
          <p>Headlines are the sources&apos; own. Nothing is ranked, summarised or rewritten.</p>
        </div>
      </details>
    </div>
  );
}

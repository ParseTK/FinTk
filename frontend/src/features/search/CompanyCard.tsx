import Link from "next/link";
import type { CompanySummary } from "@/features/market-data";
import { PortfolioToggleButton } from "@/features/portfolio";
import { WatchlistToggle, type WatchlistState } from "@/features/watchlist";
import { staggerDelay } from "@/lib/motion";
import { Card } from "@/components/ui/Card";

export interface CompanyCardProps {
  company: CompanySummary;
  index?: number;
  /** Present when sign-in is on: the card then shows the real watchlist toggle. Absent: the
   *  original in-browser toggle, unchanged. */
  watch?: WatchlistState;
  /** Where signing in should bring the visitor back to. */
  signInNext?: string;
}

export function CompanyCard({ company, index = 0, watch, signInNext }: CompanyCardProps) {
  return (
    <Card
      as="li"
      className="animate-fade-up flex flex-col items-center justify-between gap-3 md:flex-row"
      style={{ animationDelay: staggerDelay(index) }}
    >
      <Link
        href={`/company/${encodeURIComponent(company.ticker)}`}
        className="font-bold underline-offset-2 hover:underline"
      >
        {company.name} ({company.ticker})
      </Link>
      <p className="font-bold">{company.exchange}</p>
      {watch ? (
        <WatchlistToggle
          symbol={company.ticker}
          watched={watch.signedIn && watch.symbols.includes(company.ticker)}
          csrfToken={watch.signedIn ? watch.csrfToken : undefined}
          signInNext={signInNext}
        />
      ) : (
        <PortfolioToggleButton symbol={company.ticker} />
      )}
    </Card>
  );
}

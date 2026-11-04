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
      className="animate-fade-up flex flex-col items-center gap-3 md:grid md:grid-cols-[minmax(0,1fr)_6rem_14rem]"
      style={{ animationDelay: staggerDelay(index) }}
    >
      <Link
        href={`/company/${encodeURIComponent(company.ticker)}`}
        className="font-bold underline-offset-2 hover:underline"
      >
        {company.name} ({company.ticker})
      </Link>
      <p className="font-bold md:text-left">{company.exchange}</p>
      <div className="md:justify-self-end">
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
      </div>
    </Card>
  );
}

import Link from "next/link";
import type { CompanySummary } from "@/features/market-data";
import { PortfolioToggleButton } from "@/features/portfolio";
import { staggerDelay } from "@/lib/motion";
import { Card } from "@/components/ui/Card";

export function CompanyCard({ company, index = 0 }: { company: CompanySummary; index?: number }) {
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
      <PortfolioToggleButton symbol={company.ticker} />
    </Card>
  );
}

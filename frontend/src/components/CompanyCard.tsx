import Link from "next/link";
import type { CompanySearchResult } from "@/lib/types";
import { PortfolioToggleButton } from "./portfolio/PortfolioToggleButton";
import { Card } from "./ui/Card";

export function CompanyCard({ company }: { company: CompanySearchResult }) {
  return (
    <Card as="li" className="flex flex-col items-center justify-between gap-3 md:flex-row">
      <Link
        href={`/company/${encodeURIComponent(company.symbol)}`}
        className="font-bold underline-offset-2 hover:underline"
      >
        {company.name} ({company.symbol})
      </Link>
      <p>{company.currency}</p>
      <p className="font-bold">
        {company.exchange} - {company.exchangeFullName}
      </p>
      <PortfolioToggleButton symbol={company.symbol} />
    </Card>
  );
}

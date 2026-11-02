import Link from "next/link";
import type { CompanySearchResult } from "@/lib/types";
import { PortfolioToggleButton } from "./portfolio/PortfolioToggleButton";

export function CompanyCard({ company }: { company: CompanySearchResult }) {
  return (
    <li className="bg-surface-raised flex flex-col items-center justify-between gap-3 rounded-lg p-6 md:flex-row">
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
    </li>
  );
}

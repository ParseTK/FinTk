import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { Change } from "@/components/ui/Change";
import { getCompanyProfile } from "@/features/market-data";
import { formatMoney } from "@/lib/format";

type Props = { params: Promise<{ ticker: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticker } = await params;
  return { title: ticker.toUpperCase() };
}

export default async function CompanyPage({ params }: Props) {
  const { ticker } = await params;
  const company = await getCompanyProfile(ticker);
  if (!company) notFound();

  return (
    <Container size="narrow" className="py-8">
      <article className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">
            {company.companyName}{" "}
            <span className="text-fg-muted font-normal">({company.symbol})</span>
          </h1>
          <p className="flex flex-wrap items-baseline gap-3 text-2xl font-semibold tabular-nums">
            {formatMoney(company.price, { currency: company.currency })}
            <Change value={company.changePercentage} className="text-base" />
          </p>
        </header>
        <Card as="section" aria-labelledby="about-heading" className="space-y-2">
          <h2 id="about-heading" className="text-xl font-semibold">
            About
          </h2>
          <p className="text-fg-muted">{company.description}</p>
        </Card>
      </article>
    </Container>
  );
}

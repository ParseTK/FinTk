import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCompanyProfile } from "@/lib/fmp";

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
    <article className="mx-auto max-w-4xl space-y-4 px-6 py-8">
      <h1 className="text-3xl font-bold">
        {company.companyName} ({company.symbol})
      </h1>
      <p className="text-xl">
        {company.price} {company.currency}
      </p>
      <p className="text-gray-700">{company.description}</p>
    </article>
  );
}

"use client";

import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { usePortfolio } from "./PortfolioProvider";

export function PortfolioList() {
  const { symbols, remove } = usePortfolio();

  return (
    <section aria-labelledby="portfolio-heading" className="py-6">
      <Container>
        <h2 id="portfolio-heading" className="mb-4 text-center text-3xl font-semibold">
          My portfolio
        </h2>
        {symbols.length === 0 ? (
          <p className="text-fg-muted text-center text-lg">Your portfolio is empty.</p>
        ) : (
          <ul className="flex flex-wrap justify-center gap-4">
            {symbols.map((symbol) => (
              <Card as="li" key={symbol} className="flex items-center gap-3 p-4">
                <Link
                  href={`/company/${encodeURIComponent(symbol)}`}
                  className="text-lg font-bold underline-offset-2 hover:underline"
                >
                  {symbol}
                </Link>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => remove(symbol)}
                  aria-label={`Remove ${symbol} from portfolio`}
                >
                  Remove
                </Button>
              </Card>
            ))}
          </ul>
        )}
      </Container>
    </section>
  );
}

import { Card } from "@/components/ui/Card";
import { Feature } from "@/components/ui/Feature";
import { RatiosTable } from "./RatiosTable";
import type { Financials } from "./types";

/**
 * The company page's "Ratios" card, behind the `ratios` flag. It is left out entirely when the
 * company has no ratios, so there is never an empty card.
 */
export function RatiosSection({ financials }: { financials: Financials | null }) {
  if (!financials || financials.ratios.length === 0) return null;
  return (
    <Feature flag="ratios">
      <Card as="section" aria-labelledby="ratios-heading" className="space-y-3">
        <h2 id="ratios-heading" className="text-xl font-semibold">
          Ratios
        </h2>
        <p className="text-fg-muted text-sm">
          Worked out from the company&apos;s own annual SEC filings. This is arithmetic on published
          numbers, not a rating, score or forecast. A dash means a figure needed was missing, or the
          calculation would not mean anything (for example, growth measured from a loss).
        </p>
        <RatiosTable ratios={financials.ratios} />
      </Card>
    </Feature>
  );
}

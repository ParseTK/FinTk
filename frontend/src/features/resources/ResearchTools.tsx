import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/LinkButton";
import { BreakEvenCalculator, GainLossCalculator, PercentChangeCalculator } from "./Calculators";

const EYEBROW = "text-brand text-xs font-semibold tracking-[0.14em] uppercase";

/**
 * The Research tools page: small calculators that run in the browser on numbers a person types. They
 * use exact decimal arithmetic, send nothing anywhere and keep nothing, so they need no account and
 * no data from any provider.
 */
export function ResearchTools() {
  return (
    <Container className="space-y-8 py-8">
      <header className="space-y-3">
        <p className={EYEBROW}>Resources</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Research tools</h1>
        <p className="text-fg-muted max-w-2xl">
          Simple calculators for checking figures. They only do arithmetic on the numbers you type.
          Nothing you enter is sent or saved, and nothing here predicts a price.
        </p>
      </header>
      <div className="grid max-w-3xl gap-6">
        <PercentChangeCalculator />
        <GainLossCalculator />
        <BreakEvenCalculator />
      </div>
      <LinkButton href="/resources" variant="secondary">
        Back to the overview
      </LinkButton>
    </Container>
  );
}

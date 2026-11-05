import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/LinkButton";
import { areaById, type AreaId } from "./areas";

/** One area's page while its content is being written: says so plainly and points back. */
export function ResourcePlaceholder({ area }: { area: AreaId }) {
  const { title, summary } = areaById(area);
  return (
    <Container className="space-y-6 py-8">
      <header className="space-y-1">
        <p className="text-brand text-xs font-semibold tracking-[0.14em] uppercase">Resources</p>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-fg-muted">{summary}</p>
      </header>
      <div className="border-border bg-surface max-w-xl space-y-3 rounded-2xl border p-6">
        <h2 className="text-lg font-semibold">Coming soon</h2>
        <p className="text-fg-muted">
          This part of the resource desk is not written yet. Nothing here is out of date or missing
          by mistake: it simply has not been published.
        </p>
        <LinkButton href="/resources" variant="secondary">
          Back to the overview
        </LinkButton>
      </div>
    </Container>
  );
}

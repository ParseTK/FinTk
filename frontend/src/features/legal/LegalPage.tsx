import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";

export type LegalSection = { id: string; title: string; body: ReactNode };

const EYEBROW = "text-brand text-xs font-semibold tracking-[0.14em] uppercase";

/**
 * The layout shared by the legal pages: a title, the date it was last changed, a short in-page list
 * and one headed section per topic. Plain text only, so these pages need no data and cannot fail.
 */
export function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: ReactNode;
  sections: readonly LegalSection[];
}) {
  return (
    <Container className="space-y-10 py-8">
      <header className="space-y-3">
        <p className={EYEBROW}>Legal</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="text-fg-muted text-sm">Last updated {updated}</p>
        <div className="text-fg-muted max-w-2xl space-y-3">{intro}</div>
        <nav aria-label="On this page" className="pt-1">
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {sections.map(({ id, title: heading }) => (
              <li key={id}>
                <a
                  href={`#${id}-heading`}
                  className="text-brand inline-flex min-h-6 items-center font-medium underline underline-offset-4 hover:no-underline"
                >
                  {heading}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <div className="max-w-3xl space-y-10">
        {sections.map(({ id, title: heading, body }) => (
          <section key={id} aria-labelledby={`${id}-heading`} className="scroll-mt-6 space-y-3">
            <h2
              id={`${id}-heading`}
              className="border-border border-b pb-3 text-2xl font-semibold tracking-tight"
            >
              {heading}
            </h2>
            <div className="space-y-3 leading-relaxed">{body}</div>
          </section>
        ))}
      </div>
    </Container>
  );
}

/** A bulleted list in the legal pages' text style. */
export function Bullets({ items }: { items: readonly ReactNode[] }) {
  return (
    <ul className="list-disc space-y-2 pl-6">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

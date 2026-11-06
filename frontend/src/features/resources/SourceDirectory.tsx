import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/LinkButton";
import { ExternalLink } from "@/components/ui/ExternalLink";
import { FILING_TYPES, SOURCE_GROUPS } from "./sources";

const EYEBROW = "text-brand text-xs font-semibold tracking-[0.14em] uppercase";

/**
 * The Source directory: the original publishers FinTk reads, grouped by kind, each with what it
 * covers and where on FinTk it is used, plus a short guide to the SEC forms a reader will meet.
 * Static text from `sources.ts`, so the page needs no data.
 */
export function SourceDirectory() {
  return (
    <Container className="space-y-10 py-8">
      <header className="space-y-3">
        <p className={EYEBROW}>Resources</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Source directory</h1>
        <p className="text-fg-muted max-w-2xl">
          Where the original documents live. FinTk shows headlines and figures, but the source is
          always the better place to read the full text.
        </p>
      </header>

      {SOURCE_GROUPS.map((group) => (
        <section key={group.id} aria-labelledby={`${group.id}-heading`} className="space-y-4">
          <div className="border-border space-y-1 border-b pb-3">
            <h2 id={`${group.id}-heading`} className="text-2xl font-semibold tracking-tight">
              {group.title}
            </h2>
            <p className="text-fg-muted text-sm">{group.intro}</p>
          </div>
          <ul className="grid gap-4 md:grid-cols-2">
            {group.entries.map((entry) => (
              <li
                key={entry.name}
                className="border-border bg-surface flex flex-col gap-3 rounded-2xl border p-5 md:[&:last-child:nth-child(odd)]:col-span-2"
              >
                <div className="space-y-0.5">
                  <h3 className="text-lg font-semibold">
                    <ExternalLink href={entry.href}>{entry.name}</ExternalLink>
                  </h3>
                  <p className="text-fg-muted text-sm">{entry.publisher}</p>
                </div>
                <p className="text-fg-muted text-sm">{entry.covers}</p>
                <p className="text-sm">
                  <span className="font-semibold">On FinTk: </span>
                  <span className="text-fg-muted">{entry.onFinTk}</span>
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section aria-labelledby="forms-heading" className="space-y-4">
        <div className="border-border space-y-1 border-b pb-3">
          <h2 id="forms-heading" className="text-2xl font-semibold tracking-tight">
            Filing types you will meet
          </h2>
          <p className="text-fg-muted text-sm">
            The SEC forms behind most company news, in plain words.
          </p>
        </div>
        <dl className="divide-border border-border divide-y border-y">
          {FILING_TYPES.map((filing) => (
            <div key={filing.form} className="grid gap-1 py-4 md:grid-cols-[8rem_1fr] md:gap-8">
              <dt className="font-semibold">Form {filing.form}</dt>
              <dd className="text-fg-muted">{filing.meaning}</dd>
            </div>
          ))}
        </dl>
      </section>

      <LinkButton href="/resources" variant="secondary">
        Back to the overview
      </LinkButton>
    </Container>
  );
}

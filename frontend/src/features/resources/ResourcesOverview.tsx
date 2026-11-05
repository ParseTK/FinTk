import Link from "next/link";
import type { ComponentType } from "react";
import { Container } from "@/components/ui/Container";
import {
  ArrowUpRightIcon,
  BookIcon,
  DocumentIcon,
  LandmarkIcon,
  SlidersIcon,
} from "@/components/ui/icons";
import { AREAS, QUESTIONS, areaById, type AreaId } from "./areas";

const ICONS: Record<AreaId, ComponentType<{ className?: string }>> = {
  education: BookIcon,
  sources: LandmarkIcon,
  tools: SlidersIcon,
  data: DocumentIcon,
};

const EYEBROW = "text-brand text-xs font-semibold tracking-[0.14em] uppercase";

/**
 * The Resources overview: a heading, the four areas as cards, then a few questions that
 * point at the right area. Each area has its own page (listed in the sidebar), so the cards are the
 * same links shown larger, not a second navigation to maintain.
 */
export function ResourcesOverview() {
  return (
    <Container className="space-y-12 py-8 lg:space-y-14">
      <header className="grid gap-6 md:grid-cols-[1fr_minmax(0,22rem)] md:items-end">
        <div className="space-y-3">
          <p className={EYEBROW}>The Virello resource desk</p>
          <h1 className="text-4xl leading-[1.05] font-bold tracking-tight sm:text-5xl">
            A clearer route <br />
            <span className="text-brand font-medium italic">to your research.</span>
          </h1>
        </div>
        <p className="text-fg-muted">
          Learn the concepts, find the original material, and understand the figures.
        </p>
      </header>

      <section aria-labelledby="start-heading" className="space-y-5">
        <div className="border-border border-b pb-3">
          <h2 id="start-heading" className="text-lg font-semibold">
            Explore the resources
          </h2>
        </div>
        <ul className="grid gap-4 md:grid-cols-2">
          {AREAS.map((area) => {
            const Icon = ICONS[area.id];
            return (
              <li
                key={area.id}
                className="border-border bg-surface hover:border-border-strong relative flex flex-col rounded-2xl border p-6 transition-colors"
              >
                <span className="border-border text-fg-muted flex size-9 items-center justify-center rounded-lg border">
                  <Icon className="size-4" />
                </span>
                <h3 className="mt-5 text-2xl font-semibold tracking-tight">{area.title}</h3>
                <p className="text-fg-muted mt-2 max-w-sm text-sm">{area.blurb}</p>
                <ul aria-label="Topics" className="mt-4 flex flex-wrap gap-2">
                  {area.tags.map((tag) => (
                    <li
                      key={tag}
                      className="border-border bg-surface-raised text-fg-muted rounded-md border px-2 py-0.5 text-xs"
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
                <div className="border-border mt-6 flex items-center justify-between gap-3 border-t pt-4 text-sm">
                  <Link
                    href={area.href}
                    className="text-brand inline-flex items-center gap-1 font-medium after:absolute after:inset-0 after:content-[''] hover:underline"
                  >
                    {area.action}
                    <ArrowUpRightIcon />
                  </Link>
                  <span className="text-fg-muted text-xs">{area.kind}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section
        aria-labelledby="question-heading"
        className="border-border grid gap-6 border-t pt-8 md:grid-cols-[1fr_1.6fr]"
      >
        <div className="space-y-2">
          <p className={EYEBROW}>Common questions</p>
          <h2 id="question-heading" className="text-2xl font-semibold tracking-tight">
            Not sure where <br />
            to begin?
          </h2>
        </div>
        <ul>
          {QUESTIONS.map(({ question, area, label }) => (
            <li key={area} className="border-border border-b first:border-t">
              <Link
                href={areaById(area).href}
                className="hover:text-brand flex items-center justify-between gap-4 py-4"
              >
                <span>{question}</span>
                <span className="text-brand inline-flex shrink-0 items-center gap-1 text-sm">
                  {label}
                  <ArrowUpRightIcon />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </Container>
  );
}

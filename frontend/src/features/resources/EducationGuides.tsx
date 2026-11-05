import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/LinkButton";
import { GUIDE_GROUPS } from "./education";

const EYEBROW = "text-brand text-xs font-semibold tracking-[0.14em] uppercase";

/**
 * The Education page: short plain-language guides in three groups (the terms behind the figures,
 * reading a portfolio, reading research). Static text from `education.ts`, so the page needs no
 * data. Each guide is a heading with a link target, so a guide can be linked to directly.
 */
export function EducationGuides() {
  return (
    <Container className="space-y-10 py-8">
      <header className="space-y-3">
        <p className={EYEBROW}>Resources</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Education</h1>
        <p className="text-fg-muted max-w-2xl">
          Short guides to the ideas behind the figures. They explain how things work. They do not
          say what to buy or sell, and they do not predict anything.
        </p>
        <nav aria-label="On this page" className="pt-1">
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {GUIDE_GROUPS.map(({ id, title }) => (
              <li key={id}>
                <a
                  href={`#${id}-heading`}
                  className="text-brand inline-flex min-h-6 items-center font-medium underline underline-offset-4 hover:no-underline"
                >
                  {title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      {GUIDE_GROUPS.map((group) => (
        <section
          key={group.id}
          aria-labelledby={`${group.id}-heading`}
          className="scroll-mt-6 space-y-4"
        >
          <div className="border-border space-y-1 border-b pb-3">
            <h2 id={`${group.id}-heading`} className="text-2xl font-semibold tracking-tight">
              {group.title}
            </h2>
            <p className="text-fg-muted text-sm">{group.intro}</p>
          </div>
          <div className="divide-border divide-y">
            {group.guides.map((guide) => (
              <article
                key={guide.id}
                aria-labelledby={`${guide.id}-heading`}
                className="grid scroll-mt-6 gap-2 py-5 first:pt-1 md:grid-cols-[1fr_2fr] md:gap-8"
              >
                <h3 id={`${guide.id}-heading`} className="text-lg font-semibold">
                  {guide.title}
                </h3>
                <div className="text-fg-muted max-w-2xl space-y-3">
                  {guide.paragraphs.map((text) => (
                    <p key={text}>{text}</p>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      <p className="text-fg-muted border-border border-t pt-6 text-sm">
        These guides are general explanations for education. They are not investment advice.
      </p>
      <LinkButton href="/resources" variant="secondary">
        Back to the overview
      </LinkButton>
    </Container>
  );
}

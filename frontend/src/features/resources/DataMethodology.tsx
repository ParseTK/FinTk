import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/LinkButton";
import { ExternalLink } from "@/components/ui/ExternalLink";
import { FIGURES, LIMITS, SOURCES } from "./methodology";

const EYEBROW = "text-brand text-xs font-semibold tracking-[0.14em] uppercase";

const SECTIONS = [
  { id: "sources", title: "Where the figures come from" },
  { id: "figures", title: "What each figure means" },
  { id: "news", title: "How news is chosen" },
  { id: "limits", title: "Coverage and limits" },
  { id: "credits", title: "Credits" },
] as const;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-heading`} className="scroll-mt-6 space-y-4">
      <h2
        id={`${id}-heading`}
        className="border-border border-b pb-3 text-2xl font-semibold tracking-tight"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * The Data & methodology page: where each figure comes from, how old it can be, what it means, how
 * the news is picked, and what the site does not cover. Plain text from `methodology.ts`, so the
 * page needs no data and cannot fail. The headings are linked from a short in-page list.
 */
export function DataMethodology() {
  return (
    <Container className="space-y-10 py-8">
      <header className="space-y-3">
        <p className={EYEBROW}>Resources</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Data &amp; methodology</h1>
        <p className="text-fg-muted max-w-2xl">
          Where the figures come from, how old they can be, what each one means, and what Virello
          does not cover.
        </p>
        <nav aria-label="On this page" className="pt-1">
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {SECTIONS.map(({ id, title }) => (
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

      <Section id="sources" title="Where the figures come from">
        <p className="text-fg-muted max-w-2xl">
          Virello does not produce market data. It reads it from the sources below and shows it as
          published. “How old” is the longest a stored copy is used before it is read again.
        </p>
        <div
          role="region"
          aria-label="Data sources"
          tabIndex={0}
          className="border-border bg-surface relative overflow-x-auto rounded-2xl border"
        >
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">Sources, what they provide and how old it can be</caption>
            <thead>
              <tr className="border-border text-fg-muted border-b">
                <th scope="col" className="px-4 py-3 font-semibold">
                  Source
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  What it provides
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  How old
                </th>
              </tr>
            </thead>
            <tbody>
              {SOURCES.map((source) => (
                <tr key={source.name} className="border-border border-b align-top last:border-0">
                  <th scope="row" className="px-4 py-3 font-medium whitespace-nowrap">
                    <ExternalLink href={source.href}>{source.name}</ExternalLink>
                  </th>
                  <td className="text-fg-muted px-4 py-3">{source.provides}</td>
                  <td className="text-fg-muted px-4 py-3">{source.age}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="figures" title="What each figure means">
        <dl className="divide-border border-border divide-y border-y">
          {FIGURES.map((figure) => (
            <div key={figure.name} className="grid gap-1 py-4 md:grid-cols-[1fr_2fr] md:gap-8">
              <dt className="font-medium">{figure.name}</dt>
              <dd className="text-fg-muted">{figure.meaning}</dd>
            </div>
          ))}
        </dl>
        <p className="text-fg-muted text-sm">
          For how CoinMarketCap builds its own figures, read{" "}
          <ExternalLink href="https://coinmarketcap.com/methodology/">
            CoinMarketCap&apos;s methodology
          </ExternalLink>
          .
        </p>
      </Section>

      <Section id="news" title="How news is chosen">
        <div className="text-fg-muted max-w-2xl space-y-3">
          <p>
            The news page shows announcements from the SEC, the CFTC and the Department of Justice
            when the headline contains a crypto-related word or phrase, plus Form 8-K filings from a
            short, fixed list of crypto companies over the last 90 days.
          </p>
          <p>
            Headlines are the publishers&apos; own words and dates, newest first. Nothing is ranked,
            summarized or rewritten, and a story is not featured for any reason other than being the
            newest. If a source cannot be reached, the page names it.
          </p>
          <p>
            The exact word list and company list are printed on the news page, under “How items are
            chosen”, so you can always see the rule that is in use.
          </p>
        </div>
      </Section>

      <Section id="limits" title="Coverage and limits">
        <ul className="grid gap-4 md:grid-cols-2">
          {LIMITS.map((limit) => (
            <li
              key={limit.title}
              className="border-border bg-surface space-y-1 rounded-2xl border p-5 md:[&:last-child:nth-child(odd)]:col-span-2"
            >
              <h3 className="font-semibold">{limit.title}</h3>
              <p className="text-fg-muted text-sm">{limit.text}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="credits" title="Credits">
        <p className="text-fg-muted max-w-2xl">
          Market data is provided by{" "}
          <ExternalLink href="https://coinmarketcap.com/">CoinMarketCap.com</ExternalLink>.
          Announcements and filings are published by the SEC, the CFTC and the U.S. Department of
          Justice. Virello is an independent project and is not affiliated with or endorsed by any
          of them.
        </p>
        <LinkButton href="/resources" variant="secondary">
          Back to the overview
        </LinkButton>
      </Section>
    </Container>
  );
}

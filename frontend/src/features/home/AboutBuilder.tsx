import { Container } from "@/components/ui/Container";
import { ArrowUpRightIcon, GitHubIcon, GlobeIcon } from "@/components/ui/icons";
import { SITE } from "@/lib/site";

const BUILT_WITH = ["Next.js", "FastAPI", "PostgreSQL", "Accessible by design"] as const;

const LINKS = [
  { href: SITE.repoUrl, label: "View the source on GitHub", Icon: GitHubIcon },
  { href: SITE.portfolioUrl, label: "My portfolio", Icon: GlobeIcon },
] as const;

/**
 * A short note on who made the site. First name only, and nothing that is not in the project itself:
 * no job, employer or history. Shown with the other landing sections.
 */
export function AboutBuilder() {
  return (
    <section aria-labelledby="builder-heading" className="border-border border-t">
      <Container
        size="wide"
        className="grid gap-6 py-12 md:grid-cols-[1fr_1.6fr] md:gap-16 lg:py-16"
      >
        <div className="space-y-2">
          <p className="text-brand text-xs font-semibold tracking-[0.14em] uppercase">
            About the builder
          </p>
          <h2 id="builder-heading" className="text-2xl font-semibold tracking-tight">
            Hi, I&apos;m Tyler.
          </h2>
        </div>
        <div className="space-y-4">
          <p className="text-fg-muted max-w-xl">
            I built FinTk as a free, open project to show how crypto market data and official
            announcements can be presented plainly: sourced, readable by everyone, and honest about
            what is missing. It is a working full-stack app, not a mock-up, and the code is public.
          </p>
          <ul aria-label="Built with" className="flex flex-wrap gap-2">
            {BUILT_WITH.map((item) => (
              <li
                key={item}
                className="border-border bg-surface-raised text-fg-muted rounded-md border px-2 py-0.5 text-xs"
              >
                {item}
              </li>
            ))}
          </ul>
          <ul aria-label="Links" className="flex flex-wrap gap-x-6 gap-y-2">
            {LINKS.map(({ href, label, Icon }) => (
              <li key={href}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand inline-flex min-h-6 items-center gap-2 text-sm font-medium underline-offset-4 hover:underline"
                >
                  <Icon className="size-4" />
                  {label}
                  <ArrowUpRightIcon />
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}

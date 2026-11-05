import { Container } from "@/components/ui/Container";
import { SITE } from "@/lib/site";

export function Footer() {
  return (
    <footer className="border-border mt-16 border-t py-8">
      <Container size="wide" className="text-fg-muted space-y-2 text-sm">
        <p>
          {SITE.name} shows financial information for research and education. It is not investment
          advice, and data may be delayed or incomplete.
        </p>
        <p>
          <a
            href={SITE.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-fg underline underline-offset-4 hover:no-underline"
          >
            View the source on GitHub
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>
      </Container>
    </footer>
  );
}

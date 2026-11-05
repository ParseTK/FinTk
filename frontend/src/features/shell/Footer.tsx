import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { SITE } from "@/lib/site";
import { footerColumns } from "./sections";

/**
 * The footer: the same sections as the header, each with its pages listed underneath, then the
 * disclaimer and the source link. The columns come from the same list as the header and sidebar, so
 * a page that is switched off never appears here.
 */
export function Footer() {
  const columns = footerColumns();

  return (
    <footer className="border-border mt-16 border-t py-10">
      <Container size="wide" className="space-y-8 text-sm">
        {columns.length > 0 && (
          <nav aria-label="Footer" className="flex flex-wrap gap-x-16 gap-y-8">
            {columns.map((column) => (
              <div key={column.id} className="space-y-3">
                <h2 className="text-fg font-semibold">{column.label}</h2>
                <ul className="space-y-2">
                  {column.links.map(({ href, label }) => (
                    <li key={href}>
                      <Link
                        href={href}
                        className="text-fg-muted hover:text-fg underline-offset-4 hover:underline"
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        )}
        <div className="border-border text-fg-muted space-y-2 border-t pt-6">
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
        </div>
      </Container>
    </footer>
  );
}

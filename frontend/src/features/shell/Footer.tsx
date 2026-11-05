import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { GitHubIcon } from "@/components/ui/icons";
import { SITE } from "@/lib/site";
import { footerColumns } from "./sections";

/**
 * Quick links: well-known outside pages for checking things at the source. They are external on
 * purpose (no page of ours), so each one says it opens a new tab. The market data link is also the
 * provider's required credit.
 */
const QUICK_LINKS = [
  { href: "https://www.sec.gov/edgar/search/", label: "SEC EDGAR filings search" },
  { href: "https://www.cftc.gov/PressRoom/PressReleases", label: "CFTC press releases" },
  { href: "https://www.justice.gov/news", label: "Justice Department news" },
  { href: "https://coinmarketcap.com/", label: "CoinMarketCap" },
  { href: "https://coinmarketcap.com/methodology/", label: "CoinMarketCap methodology" },
] as const;

/** The legal pages. They are not sections of the product, so they sit beside the disclaimer. */
const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy policy" },
  { href: "/terms", label: "Terms of use" },
  { href: "/accessibility", label: "Accessibility" },
] as const;

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
        <div className="flex flex-wrap gap-x-16 gap-y-8 lg:justify-between">
          {columns.length > 0 && (
            <nav aria-label="Footer" className="contents">
              {columns.map((column) => (
                <div key={column.id} className="space-y-3">
                  <h2 className="text-fg font-semibold">{column.label}</h2>
                  <ul className="space-y-2">
                    {column.links.map(({ href, label }) => (
                      <li key={href}>
                        <Link
                          href={href}
                          className="text-fg-muted hover:text-fg inline-flex min-h-6 items-center underline-offset-4 hover:underline"
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
          <nav aria-label="Quick links" className="space-y-3">
            <h2 className="text-fg font-semibold">Quick links</h2>
            <ul className="space-y-2">
              {QUICK_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-fg-muted hover:text-fg inline-flex min-h-6 items-center underline-offset-4 hover:underline"
                  >
                    {label}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="border-border text-fg-muted space-y-2 border-t pt-6">
          <p>
            {SITE.name} shows financial information for research and education. It is not investment
            advice, and data may be delayed or incomplete.
          </p>
          <nav aria-label="Legal">
            <ul className="flex flex-wrap gap-x-5 gap-y-1">
              {LEGAL_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-fg-muted hover:text-fg inline-flex min-h-6 items-center underline underline-offset-4 hover:no-underline"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <p>
            <a
              href={SITE.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-fg inline-flex min-h-6 items-center gap-2 underline underline-offset-4 hover:no-underline"
            >
              <GitHubIcon className="size-5" />
              View the source on GitHub
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </p>
        </div>
      </Container>
    </footer>
  );
}

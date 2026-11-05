import { isEnabled, type FlagName } from "@/lib/flags";
import type { NavItem } from "./navigation";
import type { SectionView } from "./sectionView";

/** One page of a section. It shows only while EVERY flag it lists is on, so there is never a dead link. */
interface SectionLink {
  href: string;
  label: string;
  flags: readonly FlagName[];
  /** Current only on exactly this path, for a link whose address starts another link's. */
  exact?: boolean;
}

interface Section {
  id: string;
  label: string;
  links: readonly SectionLink[];
  /** False for a section the header already offers some other way (search has its own box). */
  inHeader?: boolean;
}

/**
 * The top-level sections, in the order the header shows them. Each is one link in the header,
 * pointing at its first page; its pages are listed in the sidebar (when it has at least two), so no
 * page is listed in both places. A page that is in no section (home, sign-in, account) has no
 * sidebar and keeps its full width. Adding a page to a section never changes its address.
 */
const SECTIONS: readonly Section[] = [
  {
    id: "crypto",
    label: "Crypto",
    links: [
      { href: "/crypto", label: "Overview", flags: ["crypto"], exact: true },
      { href: "/crypto/markets", label: "Markets", flags: ["crypto", "crypto_markets"] },
      { href: "/crypto/news", label: "News", flags: ["crypto", "crypto_news"] },
    ],
  },
  {
    // The header has a search box instead of a link; the footer lists the search page.
    id: "search",
    label: "Search",
    inHeader: false,
    links: [{ href: "/crypto/search", label: "Search coins", flags: ["crypto", "crypto_search"] }],
  },
  {
    // A signed-in person's own coins. The pages need prices (crypto) and a person (auth).
    id: "holdings",
    label: "Holdings",
    links: [
      { href: "/holdings", label: "Portfolio", flags: ["crypto", "auth", "holdings"], exact: true },
      {
        href: "/holdings/watchlist",
        label: "Watchlist",
        flags: ["crypto", "auth", "holdings"],
      },
    ],
  },
];

/** A section's pages that can be shown right now (every flag each needs is on). */
function shownLinks(section: Section) {
  return section.links
    .filter(({ flags }) => flags.every((flag) => isEnabled(flag)))
    .map(({ href, label, exact }) => ({ href, label, exact }));
}

/**
 * The sidebars to offer: every section with at least two visible pages. A sidebar with one link
 * would only be a more complicated way of showing that link.
 */
export function visibleSections(): SectionView[] {
  return SECTIONS.map((section) => ({
    id: section.id,
    label: section.label,
    links: shownLinks(section),
  })).filter((section) => section.links.length >= 2);
}

/**
 * The links for the header: one per section that has at least one visible page, going to the
 * section's first page and current on all of its pages.
 */
export function headerItems(): NavItem[] {
  return SECTIONS.filter((section) => section.inHeader !== false)
    .map((section) => ({ section, links: shownLinks(section) }))
    .filter(({ links }) => links.length > 0)
    .map(({ section, links }) => ({
      href: links[0]!.href,
      label: section.label,
      alsoActive: links.map((link) => link.href),
    }));
}

/**
 * The footer's columns: every section that has at least one visible page, with all of its pages
 * underneath (the footer lists a single-page section too, unlike the sidebar).
 */
export function footerColumns(): SectionView[] {
  return SECTIONS.map((section) => ({
    id: section.id,
    label: section.label,
    links: shownLinks(section),
  })).filter((section) => section.links.length > 0);
}

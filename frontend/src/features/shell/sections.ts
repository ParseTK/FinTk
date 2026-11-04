import { isEnabled, type FlagName } from "@/lib/flags";
import type { Mode } from "@/lib/mode";
import type { NavItem } from "./navigation";
import { navItems } from "./navItems";
import type { SectionView } from "./sectionView";

/** One subpage of a section. It shows only while EVERY flag it lists is on (as with the main nav). */
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
  /** Which modes list this section in the top bar. Left out: both. The sidebar ignores it. */
  modes?: readonly Mode[];
  /** Other paths that belong to the section without being one of its pages (a company page). */
  also?: readonly string[];
  links: readonly SectionLink[];
}

/**
 * The top-level sections, in the order the top bar shows them. Each is one link in the top bar,
 * pointing at its first page; its pages are listed in the sidebar (when it has at least two), so no
 * page is listed in both places. A page that is in no section (home, search results, sign-in) has no
 * sidebar and keeps its full width. Adding a page to a section never changes its address.
 */
const SECTIONS: readonly Section[] = [
  {
    id: "research",
    label: "Research",
    modes: ["stocks"],
    also: ["/company"],
    links: [{ href: "/search", label: "Search", flags: [] }],
  },
  {
    id: "markets",
    label: "Markets",
    modes: ["stocks"],
    links: [
      { href: "/markets", label: "Overview", flags: ["markets"] },
      { href: "/news", label: "News", flags: ["news"] },
    ],
  },
  {
    id: "crypto",
    label: "Crypto",
    modes: ["crypto"],
    links: [
      { href: "/crypto", label: "Overview", flags: ["crypto"], exact: true },
      { href: "/crypto/markets", label: "Markets", flags: ["crypto", "crypto_markets"] },
      { href: "/crypto/news", label: "News", flags: ["crypto", "crypto_news"] },
    ],
  },
  {
    id: "holdings",
    label: "Holdings",
    links: [
      { href: "/portfolio", label: "Portfolio", flags: ["auth"] },
      { href: "/watchlist", label: "Watchlist", flags: ["auth"] },
      { href: "/account", label: "Account", flags: ["auth"] },
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
 * The sidebars to offer: none while `app_shell` is off, otherwise every section with at least two
 * visible pages. A sidebar with one link would only be a more complicated way of showing that link.
 * The mode does not matter here: the sidebar belongs to the page you are on, so switching mode can
 * never make it vanish.
 */
export function visibleSections(): SectionView[] {
  if (!isEnabled("app_shell")) return [];
  return SECTIONS.map((section) => ({
    id: section.id,
    label: section.label,
    links: shownLinks(section),
  })).filter((section) => section.links.length >= 2);
}

/**
 * The links for the top bar. With `app_shell` off these are the usual page links. With it on they
 * are the sections of the current mode (all of them with no mode), one link each to the section's
 * first page, current on every page of the section. Pages are never repeated between top bar and
 * sidebar.
 */
export function headerItems(mode?: Mode | null): NavItem[] {
  if (!isEnabled("app_shell")) return navItems(mode);
  return SECTIONS.filter((section) => !mode || !section.modes || section.modes.includes(mode))
    .map((section) => ({ section, links: shownLinks(section) }))
    .filter(({ links }) => links.length > 0)
    .map(({ section, links }) => ({
      href: links[0]!.href,
      label: section.label,
      alsoActive: [...links.map((link) => link.href), ...(section.also ?? [])],
    }));
}

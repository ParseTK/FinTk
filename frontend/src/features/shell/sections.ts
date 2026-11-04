import { isEnabled, type FlagName } from "@/lib/flags";
import type { Mode } from "@/lib/mode";
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
  /** Left out: shown in both modes. */
  modes?: readonly Mode[];
  links: readonly SectionLink[];
}

/**
 * The sections that have several pages, and so get a sidebar. A page that is in no section (home,
 * a company, search results) has no sidebar and keeps its full width. Adding a page to a section
 * never changes its address.
 */
const SECTIONS: readonly Section[] = [
  {
    id: "holdings",
    label: "Holdings",
    links: [
      { href: "/portfolio", label: "Portfolio", flags: ["auth"] },
      { href: "/watchlist", label: "Watchlist", flags: ["auth"] },
      { href: "/account", label: "Account", flags: ["auth"] },
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
    id: "markets",
    label: "Markets",
    modes: ["stocks"],
    links: [
      { href: "/markets", label: "Overview", flags: ["markets"] },
      { href: "/news", label: "News", flags: ["news"] },
    ],
  },
];

/**
 * The sections to show right now: none while `app_shell` is off, otherwise those for the mode
 * (all of them with no mode) that have at least two visible pages. A sidebar with one link would
 * only be a more complicated way of showing that link.
 */
export function visibleSections(mode?: Mode | null): SectionView[] {
  if (!isEnabled("app_shell")) return [];
  return SECTIONS.filter((section) => !mode || !section.modes || section.modes.includes(mode))
    .map(({ id, label, links }) => ({
      id,
      label,
      links: links
        .filter(({ flags }) => flags.every((flag) => isEnabled(flag)))
        .map(({ href, label: text, exact }) => ({ href, label: text, exact })),
    }))
    .filter((section) => section.links.length >= 2);
}

import type { Mode } from "@/lib/mode";

export interface NavItem {
  href: string;
  label: string;
  /**
   * Which modes show this link, when the Crypto | Stocks switch is on. Left out means both. With the
   * switch off every link shows, whatever its modes say.
   */
  modes?: readonly Mode[];
  /**
   * Active only on exactly this path, not on the pages beneath it. For a link whose address is the
   * start of another link's (Crypto, /crypto, and Crypto markets, /crypto/markets), so only one of
   * them is marked as the current page.
   */
  exact?: boolean;
  /**
   * Other paths on which this link is also the current one: a section link (Crypto) is current on
   * every page of its section, and those pages are listed in the sidebar, not in the top bar.
   */
  alsoActive?: readonly string[];
}

/**
 * Main navigation. Add an item here when its page exists (and gate it with a feature flag in the
 * Navbar if the page is still behind one), so there is never a link to a page that is not there.
 * Planned: Markets, News (flagged), and Watchlist / Portfolio once sign-in exists.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/search", label: "Search", modes: ["stocks"] },
];

/** Below this many items the links stay inline on small screens instead of collapsing into a menu. */
export const COLLAPSE_AFTER = 2;

export function isActivePath(pathname: string, href: string, exact = false): boolean {
  if (href === "/" || exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

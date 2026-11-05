export interface NavItem {
  href: string;
  label: string;
  /**
   * Active only on exactly this path, not on the pages beneath it. For a link whose address is the
   * start of another link's, so only one of them is marked as the current page.
   */
  exact?: boolean;
  /**
   * Other paths on which this link is also the current one: a section link (Crypto) is current on
   * every page of its section, and those pages are listed in the sidebar, not in the top bar.
   */
  alsoActive?: readonly string[];
}

/** Below this many items the links stay inline on small screens instead of collapsing into a menu. */
export const COLLAPSE_AFTER = 2;

export function isActivePath(pathname: string, href: string, exact = false): boolean {
  if (href === "/" || exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

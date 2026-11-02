export interface NavItem {
  href: string;
  label: string;
}

/**
 * Main navigation. Add an item here when its page exists (and gate it with a feature flag in the
 * Navbar if the page is still behind one), so there is never a link to a page that is not there.
 * Planned: Markets, News (flagged), and Watchlist / Portfolio once sign-in exists.
 */
export const NAV_ITEMS: readonly NavItem[] = [{ href: "/search", label: "Search" }];

/** Below this many items the links stay inline on small screens instead of collapsing into a menu. */
export const COLLAPSE_AFTER = 2;

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

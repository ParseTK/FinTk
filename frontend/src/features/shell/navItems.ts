import { isEnabled, type FlagName } from "@/lib/flags";
import { NAV_ITEMS, type NavItem } from "./navigation";

/** Links for pages that are still behind a feature flag; each shows only while its flag is on. */
const FLAGGED_ITEMS: ReadonlyArray<NavItem & { flag: FlagName }> = [
  { href: "/markets", label: "Markets", flag: "markets" },
  { href: "/news", label: "News", flag: "news" },
];

/** The links to show right now: the always-on ones plus every flagged one whose flag is on. */
export function navItems(): NavItem[] {
  return [
    ...NAV_ITEMS,
    ...FLAGGED_ITEMS.filter(({ flag }) => isEnabled(flag)).map(({ href, label }) => ({
      href,
      label,
    })),
  ];
}

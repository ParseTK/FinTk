import { isEnabled, type FlagName } from "@/lib/flags";
import type { Mode } from "@/lib/mode";
import { NAV_ITEMS, type NavItem } from "./navigation";

/** Links for pages that are still behind a feature flag; each shows only while its flag is on. */
const FLAGGED_ITEMS: ReadonlyArray<NavItem & { flag: FlagName }> = [
  { href: "/markets", label: "Markets", flag: "markets", modes: ["stocks"] },
  { href: "/crypto", label: "Crypto", flag: "crypto", modes: ["crypto"] },
  { href: "/news", label: "News", flag: "news", modes: ["stocks"] },
];

/**
 * The links to show right now: the always-on ones plus every flagged one whose flag is on. Given a
 * `mode` (only while the Crypto | Stocks switch is on) the list is narrowed to that mode's links;
 * with no mode every link shows, as before the switch existed.
 */
export function navItems(mode?: Mode | null): NavItem[] {
  const items: NavItem[] = [
    ...NAV_ITEMS,
    ...FLAGGED_ITEMS.filter(({ flag }) => isEnabled(flag)).map(({ href, label, modes }) => ({
      href,
      label,
      modes,
    })),
  ];
  if (!mode) return items;
  return items.filter((item) => !item.modes || item.modes.includes(mode));
}

import { isEnabled, type FlagName } from "@/lib/flags";
import type { Mode } from "@/lib/mode";
import { NAV_ITEMS, type NavItem } from "./navigation";

/**
 * Links for pages that are still behind feature flags. A link shows only while EVERY flag it lists is
 * on, the same rule the request proxy applies to the page itself, so there is never a link to a page
 * that answers 404.
 */
const FLAGGED_ITEMS: ReadonlyArray<NavItem & { flags: readonly FlagName[] }> = [
  { href: "/markets", label: "Markets", flags: ["markets"], modes: ["stocks"] },
  { href: "/crypto", label: "Crypto", flags: ["crypto"], modes: ["crypto"], exact: true },
  {
    href: "/crypto/markets",
    label: "Crypto markets",
    flags: ["crypto", "crypto_markets"],
    modes: ["crypto"],
  },
  { href: "/news", label: "News", flags: ["news"], modes: ["stocks"] },
];

/**
 * The links to show right now: the always-on ones plus every flagged one whose flags are all on.
 * Given a `mode` (only while the Crypto | Stocks switch is on) the list is narrowed to that mode's
 * links; with no mode every link shows, as before the switch existed.
 */
export function navItems(mode?: Mode | null): NavItem[] {
  const items: NavItem[] = [
    ...NAV_ITEMS,
    ...FLAGGED_ITEMS.filter(({ flags }) => flags.every((flag) => isEnabled(flag))).map(
      ({ href, label, modes, exact }) => ({ href, label, modes, exact }),
    ),
  ];
  if (!mode) return items;
  return items.filter((item) => !item.modes || item.modes.includes(mode));
}

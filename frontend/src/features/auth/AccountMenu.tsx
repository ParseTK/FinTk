import { LinkButton } from "@/components/ui/LinkButton";
import { isEnabled } from "@/lib/flags";
import { AccountMenuView } from "./AccountMenuView";
import { getSession } from "./session";

/**
 * The holdings pages as menu entries, in the order the sidebar lists them. They need the prices
 * (crypto) and their own flag; this menu only exists for a signed-in person, so auth is already on.
 */
function holdingsLinks() {
  if (!isEnabled("crypto") || !isEnabled("holdings")) return [];
  return [
    { href: "/holdings", label: "Portfolio" },
    { href: "/holdings/watchlist", label: "Watchlist" },
  ];
}

/** Header entry point: a Sign in link for visitors, an account menu for people who are signed in. */
export async function AccountMenu() {
  const { user, csrfToken } = await getSession();
  if (!user || !csrfToken) {
    return (
      <LinkButton href="/sign-in" variant="secondary" size="sm">
        Sign in
      </LinkButton>
    );
  }
  return <AccountMenuView user={user} csrfToken={csrfToken} holdingsLinks={holdingsLinks()} />;
}

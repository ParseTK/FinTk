import { LinkButton } from "@/components/ui/LinkButton";
import { AccountMenuView } from "./AccountMenuView";
import { getSession } from "./session";

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
  return <AccountMenuView user={user} csrfToken={csrfToken} />;
}

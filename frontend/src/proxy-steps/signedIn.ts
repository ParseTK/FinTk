import { isUnder } from "./gates";

/** Pages that only make sense for a signed-in person, and the API's session cookie names. */
const SIGNED_IN_PAGES = ["/holdings", "/account"] as const;
const SESSION_COOKIES = ["__Host-fintk_session", "fintk_session"] as const;

/**
 * Whether a visitor with no session cookie should be sent to sign in before the page renders. Left
 * to the page, the shell and sidebar would stream first and flash. The page still checks the session
 * itself: a stale cookie gets through to that check.
 */
export function needsSignIn(pathname: string, cookies: { has(name: string): boolean }): boolean {
  return (
    SIGNED_IN_PAGES.some((prefix) => isUnder(pathname, prefix)) &&
    !SESSION_COOKIES.some((name) => cookies.has(name))
  );
}

/** The sign-in page address that brings the person back to where they were going. */
export function signInUrl(requestUrl: string, pathname: string): URL {
  const target = new URL("/sign-in", requestUrl);
  target.searchParams.set("next", pathname);
  return target;
}

import { NextResponse, type NextRequest } from "next/server";
import { apiBaseUrl } from "@/lib/api/url";
import { isEnabled, type FlagName } from "@/lib/flag-core";

/**
 * The request proxy: runs before routing for the paths in `config.matcher` only.
 *
 * 1. Pages that exist only while a feature flag is on answer a real 404 while it is off. Without
 *    this the page would stream a "Not found" screen with status 200 (a soft 404), because the
 *    root loading UI has already started the response by the time the page can say it is missing.
 *
 * 2. Forwards the browser's sign-in calls to the API. Browsers only ever talk to this origin, so
 *    the session cookie stays same-site (no CORS, no third-party cookie rules). The destination is
 *    read at request time. Only the paths below are forwarded: the rest of the API (company data
 *    and so on) is called by the server directly and is not exposed to browsers through here.
 */

const GATED_PAGES: ReadonlyArray<readonly [prefix: string, flag: FlagName]> = [
  ["/design", "design"],
  ["/sign-in", "auth"],
  ["/account", "auth"],
];

/** API paths a browser may reach through this proxy, and the flag that switches them on. */
const FORWARDED = { flag: "auth", exact: ["/api/v1/me"], prefixes: ["/api/v1/auth/"] } as const;

const isUnder = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

/** Rewriting to a path that does not exist renders the app's not-found page with status 404. */
function notFound(request: NextRequest) {
  return NextResponse.rewrite(new URL("/not-found-disabled", request.url));
}

export function isForwardedApiPath(pathname: string): boolean {
  return (
    (FORWARDED.exact as readonly string[]).includes(pathname) ||
    FORWARDED.prefixes.some((prefix) => pathname.startsWith(prefix))
  );
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    if (!isEnabled(FORWARDED.flag) || !isForwardedApiPath(pathname)) return notFound(request);
    return NextResponse.rewrite(new URL(`${pathname}${search}`, apiBaseUrl()));
  }

  const gated = GATED_PAGES.find(([prefix]) => isUnder(pathname, prefix));
  if (gated && !isEnabled(gated[1])) return notFound(request);
  return NextResponse.next();
}

export const config = {
  matcher: ["/design", "/design/:path*", "/sign-in", "/account", "/api/:path*"],
};

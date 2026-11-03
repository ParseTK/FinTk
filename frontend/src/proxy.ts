import { NextResponse, type NextRequest } from "next/server";
import { apiBaseUrl } from "@/lib/api/url";
import { isEnabled, type FlagName } from "@/lib/flag-core";
import { isValidTicker } from "@/lib/ticker";

/**
 * The request proxy: runs before routing for the paths in `config.matcher` only.
 *
 * 1. Pages that exist only while a feature flag is on answer a real 404 while it is off. Without
 *    this the page would stream a "Not found" screen with status 200 (a soft 404), because the
 *    root loading UI has already started the response by the time the page can say it is missing.
 *
 * 2. A company page for a ticker that does not exist answers a real 404 for the same reason: the
 *    page cannot set the status once the loading UI has started streaming. A malformed ticker is
 *    refused without a network call; a well-formed one is checked against the API, and if that
 *    check cannot be made (API down or slow) the request goes on to the page, which shows its own
 *    error. The proxy never turns an outage into a "not found".
 *
 * 3. Forwards the browser's sign-in, watchlist and portfolio calls to the API. Browsers only ever talk to this origin, so
 *    the session cookie stays same-site (no CORS, no third-party cookie rules). The destination is
 *    read at request time. Only the paths below are forwarded: the rest of the API (company data
 *    and so on) is called by the server directly and is not exposed to browsers through here.
 */

const GATED_PAGES: ReadonlyArray<readonly [prefix: string, flag: FlagName]> = [
  ["/design", "design"],
  ["/markets", "markets"],
  ["/sign-in", "auth"],
  ["/account", "auth"],
  ["/watchlist", "auth"],
  ["/portfolio", "auth"],
];

/** API paths a browser may reach through this proxy, and the flag that switches them on. */
const FORWARDED = {
  flag: "auth",
  exact: ["/api/v1/me", "/api/v1/watchlist", "/api/v1/portfolio"],
  prefixes: ["/api/v1/auth/", "/api/v1/watchlist/", "/api/v1/portfolio/"],
} as const;

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

const COMPANY_CHECK_TIMEOUT_MS = 2500;

/** True or false if the API says, null if it could not be asked. */
async function companyExists(ticker: string): Promise<boolean | null> {
  try {
    const response = await fetch(
      new URL(`/api/v1/companies/${encodeURIComponent(ticker)}`, apiBaseUrl()),
      { signal: AbortSignal.timeout(COMPANY_CHECK_TIMEOUT_MS), cache: "no-store" },
    );
    if (response.status === 404) return false;
    return response.ok ? true : null;
  } catch {
    return null;
  }
}

function tickerIn(pathname: string): string | null {
  const segment = pathname.slice("/company/".length);
  try {
    return decodeURIComponent(segment);
  } catch {
    return null; // a stray % that is not an escape: not a ticker
  }
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/company/")) {
    const ticker = tickerIn(pathname);
    if (ticker === null || !isValidTicker(ticker)) return notFound(request);
    if ((await companyExists(ticker)) === false) return notFound(request);
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    if (!isEnabled(FORWARDED.flag) || !isForwardedApiPath(pathname)) return notFound(request);
    return NextResponse.rewrite(new URL(`${pathname}${search}`, apiBaseUrl()));
  }

  const gated = GATED_PAGES.find(([prefix]) => isUnder(pathname, prefix));
  if (gated && !isEnabled(gated[1])) return notFound(request);
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/design",
    "/design/:path*",
    "/markets",
    "/company/:ticker",
    "/sign-in",
    "/account",
    "/watchlist",
    "/portfolio",
    "/api/:path*",
  ],
};

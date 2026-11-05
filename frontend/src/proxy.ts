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
 *    read at request time. Only the paths below are forwarded: the rest of the API (crypto data and
 *    so on) is called by the server directly and is not exposed to browsers through here.
 */

const GATED_PAGES: ReadonlyArray<readonly [prefix: string, flag: FlagName]> = [
  ["/design", "design"],
  ["/crypto", "crypto"],
  ["/crypto/markets", "crypto_markets"],
  ["/crypto/news", "crypto_news"],
  ["/crypto/search", "crypto_search"],
  ["/crypto/coins", "crypto_search"],
  ["/sign-in", "auth"],
  ["/account", "auth"],
];

/** API paths a browser may reach through this proxy, and the flag that switches them on. */
const FORWARDED = {
  flag: "auth",
  exact: ["/api/v1/me"],
  prefixes: ["/api/v1/auth/"],
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

const COIN_PAGE = /^\/crypto\/coins\/([^/]+)$/;
const COIN_SLUG = /^[a-z0-9][a-z0-9._-]{0,79}$/;
const COIN_CHECK_MS = 3000;

/**
 * Whether a coin page is for a coin this site covers. Asked here, before the page starts
 * streaming, so an unknown coin is a real 404 and not a "not found" screen with status 200. A
 * malformed name is refused without asking. If the API cannot answer in time the page is let
 * through (it shows its own message), so an outage never turns good links into 404s.
 */
async function coinMissing(raw: string): Promise<boolean> {
  let slug: string;
  try {
    slug = decodeURIComponent(raw);
  } catch {
    return true; // not valid percent-encoding: no coin has such a name
  }
  if (!COIN_SLUG.test(slug)) return true;
  try {
    const headers: Record<string, string> = {};
    if (process.env.INTERNAL_API_TOKEN)
      headers["X-Internal-Token"] = process.env.INTERNAL_API_TOKEN;
    const response = await fetch(new URL(`/api/v1/crypto/coins/${slug}`, apiBaseUrl()), {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(COIN_CHECK_MS),
    });
    return response.status === 404;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    if (!isEnabled(FORWARDED.flag) || !isForwardedApiPath(pathname)) return notFound(request);
    return NextResponse.rewrite(new URL(`${pathname}${search}`, apiBaseUrl()));
  }

  // Every gate that matches must be open: /crypto/markets needs both the crypto and the crypto_markets
  // flags, so turning the markets page on never opens it while the crypto page itself is off.
  const closed = GATED_PAGES.some(
    ([prefix, flag]) => isUnder(pathname, prefix) && !isEnabled(flag),
  );
  if (closed) return notFound(request);

  const coin = COIN_PAGE.exec(pathname);
  if (coin && (await coinMissing(coin[1]!))) return notFound(request);
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/design",
    "/design/:path*",
    "/crypto",
    "/crypto/markets",
    "/crypto/news",
    "/crypto/search",
    "/crypto/coins/:path*",
    "/sign-in",
    "/account",
    "/api/:path*",
  ],
};

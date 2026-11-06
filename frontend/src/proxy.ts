import { NextResponse, type NextRequest } from "next/server";
import { apiBaseUrl } from "@/lib/api/url";
import { coinFromPath, coinMissing } from "./proxy-steps/coinCheck";
import { isForwardedApiPath } from "./proxy-steps/forwarding";
import { isGatedOff } from "./proxy-steps/gates";
import { pagePolicy } from "./proxy-steps/pagePolicy";
import { needsSignIn, signInUrl } from "./proxy-steps/signedIn";

/**
 * The request proxy: runs before routing for the paths in `config.matcher` only. It is a short
 * pipeline; each step lives in its own file under `proxy-steps/` and owns one rule:
 *
 * - `forwarding`: which API calls a browser may make through this origin (the session cookie then
 *   stays same-site, and the data provider's prices are never exposed to browsers).
 * - `gates`: pages that answer a real 404 while their feature flag is off. Without this the page
 *   would stream a "Not found" screen with status 200, because the root loading UI has already
 *   started the response by the time the page can say it is missing.
 * - `signedIn`: pages only for a signed-in person send a visitor with no session to sign in first.
 * - `coinCheck`: an unknown coin is a real 404.
 * - `pagePolicy`: every page gets its Content-Security-Policy with a fresh nonce.
 */

/** Rewriting to a path that does not exist renders the app's not-found page with status 404. */
function notFound(request: NextRequest, headers: Headers) {
  return NextResponse.rewrite(new URL("/not-found-disabled", request.url), {
    request: { headers },
  });
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // The API sets its own headers (a strict default-src none), so only pages get a policy.
  if (pathname.startsWith("/api/")) {
    if (!isForwardedApiPath(pathname, request.method)) return notFound(request, request.headers);
    return NextResponse.rewrite(new URL(`${pathname}${search}`, apiBaseUrl()));
  }

  const policy = pagePolicy(request.headers);
  const response = await routePage(request, policy.headers);
  policy.attach(response);
  return response;
}

async function routePage(request: NextRequest, headers: Headers) {
  const { pathname } = request.nextUrl;

  if (isGatedOff(pathname)) return notFound(request, headers);
  if (needsSignIn(pathname, request.cookies)) {
    return NextResponse.redirect(signInUrl(request.url, pathname));
  }
  const coin = coinFromPath(pathname);
  if (coin !== null && (await coinMissing(coin))) return notFound(request, headers);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Every page gets the policy (and keeps the gates above). Static files and images need neither.
  matcher: ["/((?!_next/static|_next/image|icon.svg|robots.txt|llms.txt).*)"],
};

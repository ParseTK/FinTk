import { NextResponse, type NextRequest } from "next/server";
import { isEnabled } from "@/lib/flag-core";

/**
 * Returns a real 404 for /design while its feature flag is off. Without this, the page would
 * stream a "Not found" screen with status 200 (a soft 404), because the root loading UI has
 * already started the response by the time the page can say it does not exist.
 */
export function proxy(_request: NextRequest) {
  if (!isEnabled("design")) {
    // Rewriting to a path that does not exist renders the app's not-found page with status 404.
    return NextResponse.rewrite(new URL("/design-is-disabled", _request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/design", "/design/:path*"] };

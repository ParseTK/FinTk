import { apiBaseUrl } from "@/lib/api/url";

const COIN_PAGE = /^\/crypto\/coins\/([^/]+)$/;
const COIN_SLUG = /^[a-z0-9][a-z0-9._-]{0,79}$/;
const COIN_CHECK_MS = 3000;

/** The raw (still percent-encoded) coin name when the path is a coin page, otherwise null. */
export function coinFromPath(pathname: string): string | null {
  return COIN_PAGE.exec(pathname)?.[1] ?? null;
}

/**
 * Whether a coin page is for a coin this site covers. Asked here, before the page starts
 * streaming, so an unknown coin is a real 404 and not a "not found" screen with status 200. A
 * malformed name is refused without asking. If the API cannot answer in time the page is let
 * through (it shows its own message), so an outage never turns good links into 404s.
 */
export async function coinMissing(raw: string): Promise<boolean> {
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

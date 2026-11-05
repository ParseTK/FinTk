import "server-only";
import createClient from "openapi-fetch";
import type { paths } from "./schema";
import { apiBaseUrl } from "./url";

const REVALIDATE_SECONDS = 300;
const TIMEOUT_MS = 10_000;

export const INTERNAL_TOKEN_HEADER = "X-Internal-Token";

/**
 * Proves to the API that this call comes from our own website server. Routes that return a data
 * vendor's content require it, because the vendor's licence allows that data only inside our
 * product and never as a public feed. Server-side only: the variable has no NEXT_PUBLIC_ prefix, so
 * it never reaches a browser. Read per request so a changed value applies without a rebuild.
 */
function withInternalToken(request: Request): Request {
  const token = process.env.INTERNAL_API_TOKEN;
  if (token) request.headers.set(INTERNAL_TOKEN_HEADER, token);
  return request;
}

/**
 * Typed clients generated from the API contract (`schema.d.ts`). Every call has a timeout.
 *
 * - `publicApi`: the same answer for everyone (official crypto news), cached by Next for a few minutes.
 * - `privateApi`: anything that depends on who is asking (the signed-in user). Never cached: a
 *   cached response could be served to a different visitor.
 */
export const publicApi = createClient<paths>({
  baseUrl: apiBaseUrl(),
  fetch: (request) =>
    fetch(withInternalToken(request), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: REVALIDATE_SECONDS },
    }),
});

export const privateApi = createClient<paths>({
  baseUrl: apiBaseUrl(),
  fetch: (request) =>
    fetch(withInternalToken(request), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    }),
});

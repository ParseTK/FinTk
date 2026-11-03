import "server-only";
import createClient from "openapi-fetch";
import type { paths } from "./schema";
import { apiBaseUrl } from "./url";

const REVALIDATE_SECONDS = 300;
const TIMEOUT_MS = 10_000;

/**
 * Typed clients generated from the API contract (`schema.d.ts`). Every call has a timeout.
 *
 * - `publicApi`: the same answer for everyone (company data), cached by Next for a few minutes.
 * - `privateApi`: anything that depends on who is asking (the signed-in user). Never cached: a
 *   cached response could be served to a different visitor.
 */
export const publicApi = createClient<paths>({
  baseUrl: apiBaseUrl(),
  fetch: (request) =>
    fetch(request, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: REVALIDATE_SECONDS },
    }),
});

export const privateApi = createClient<paths>({
  baseUrl: apiBaseUrl(),
  fetch: (request) =>
    fetch(request, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" }),
});

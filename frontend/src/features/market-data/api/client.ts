import "server-only";
import createClient from "openapi-fetch";
import type { paths } from "./schema";

const REVALIDATE_SECONDS = 300;
const TIMEOUT_MS = 10_000;

/** Where the FastAPI service lives. Server-side only: the browser never calls it directly. */
export const apiBaseUrl = () => process.env.API_URL ?? "http://localhost:8000";

/**
 * Typed client generated from the API contract (`schema.d.ts`). Every call has a timeout and is
 * cached by Next for a few minutes; the API sets its own Cache-Control for everything else.
 */
export const api = createClient<paths>({
  baseUrl: apiBaseUrl(),
  fetch: (request) =>
    fetch(request, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: REVALIDATE_SECONDS },
    }),
});

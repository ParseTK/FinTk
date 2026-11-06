import "server-only";
import createClient from "openapi-fetch";
import type { paths } from "./schema";
import { apiBaseUrl } from "./url";

import { fetchWithWake, type WakeOptions } from "./wake";

const REVALIDATE_SECONDS = 300;
const TIMEOUT_MS = 10_000;
/** The who-is-this check runs on every page, so it must give up fast; it still wakes a sleeping API. */
const SESSION_TIMEOUT_MS = 4_000;
const WAKE_BUDGET_MS = 60_000;
const WAKE_PAUSE_MS = 2_000;

/**
 * How long a data read waits for a sleeping API to start. Only in production, where the free host
 * stops the API when idle: in development a down API should fail fast. API_WAKE_BUDGET_MS overrides
 * it (0 turns the patience off).
 */
function wakeOptions(): WakeOptions {
  const raw = process.env.API_WAKE_BUDGET_MS?.trim();
  const set = raw ? Number(raw) : Number.NaN;
  const budget = Number.isFinite(set)
    ? set
    : process.env.NODE_ENV === "production"
      ? WAKE_BUDGET_MS
      : 0;
  return { budgetMs: budget, attemptMs: TIMEOUT_MS, pauseMs: WAKE_PAUSE_MS };
}

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
    fetchWithWake(
      withInternalToken(request),
      (attempt, timeoutMs) =>
        fetch(attempt, {
          signal: AbortSignal.timeout(timeoutMs),
          next: { revalidate: REVALIDATE_SECONDS },
        }),
      wakeOptions(),
    ),
});

export const privateApi = createClient<paths>({
  baseUrl: apiBaseUrl(),
  fetch: (request) =>
    fetchWithWake(
      withInternalToken(request),
      (attempt, timeoutMs) =>
        fetch(attempt, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store" }),
      wakeOptions(),
    ),
});

/**
 * For the check that runs on every page (who is signed in): short timeout, no waiting for a
 * sleeping API, so a cold start never stalls pages that need no data. The request itself still
 * reaches the host, which starts the API.
 */
export const quickApi = createClient<paths>({
  baseUrl: apiBaseUrl(),
  fetch: (request) =>
    fetch(withInternalToken(request), {
      signal: AbortSignal.timeout(SESSION_TIMEOUT_MS),
      cache: "no-store",
    }),
});

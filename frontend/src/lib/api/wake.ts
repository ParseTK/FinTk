/**
 * Patience for an API that is asleep. A free-tier host stops the API after a quiet spell and takes
 * about a minute to start it again; the first visitor after that would otherwise see an error for a
 * service that is simply starting. A read that fails the way a sleeping service fails (no answer
 * in time, a refused connection, or a gateway error from the host rather than from our API) is
 * tried again for up to `budgetMs`; anything else, including every error our own API returns, is
 * handed back at once. Only reads are repeated: a write is never sent twice.
 *
 * Framework-free so it is unit-tested with a fake clock; client.ts wires in the real fetch.
 */

export interface WakeOptions {
  /** How long to keep trying in total. 0 means one attempt only (development, tests). */
  budgetMs: number;
  /** How long one attempt may take before it counts as no answer. */
  attemptMs: number;
  /** The pause between attempts. */
  pauseMs: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export type Send = (request: Request, timeoutMs: number) => Promise<Response>;

const READS = new Set(["GET", "HEAD"]);
const GATEWAY_ERRORS = new Set([502, 503, 504]);

/** A gateway error that did not come from our API (ours are always JSON with an `error` body). */
export function isHostError(response: Response): boolean {
  if (!GATEWAY_ERRORS.has(response.status)) return false;
  return !(response.headers.get("content-type") ?? "").includes("application/json");
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function fetchWithWake(
  request: Request,
  send: Send,
  { budgetMs, attemptMs, pauseMs, sleep = defaultSleep, now = Date.now }: WakeOptions,
): Promise<Response> {
  if (budgetMs <= 0 || !READS.has(request.method)) return send(request, attemptMs);

  const started = now();
  let lastResponse: Response | null = null;
  let lastError: unknown = null;
  for (;;) {
    try {
      const response = await send(request.clone(), attemptMs);
      if (!isHostError(response)) return response;
      lastResponse = response;
      lastError = null;
    } catch (error) {
      lastError = error;
      lastResponse = null;
    }
    if (now() - started + pauseMs >= budgetMs) break;
    await sleep(pauseMs);
  }
  if (lastResponse) return lastResponse;
  throw lastError;
}

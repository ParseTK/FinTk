/**
 * Browser-side requests that change state (sign out, delete the account), in one place so 401 and
 * 403 are handled the same way everywhere instead of in each button.
 *
 * Calls go to our own origin (the request proxy forwards them to the API), so the browser attaches
 * the session cookie and an Origin header by itself. We add the per-session CSRF token.
 */

export type MutationResult =
  /** Done. */
  | "ok"
  /** No longer signed in (the session expired or ended elsewhere). Treat as done and refresh. */
  | "signed-out"
  /** The CSRF check failed: the page is stale. Reloading gets a fresh token. */
  | "stale"
  /** Anything else, including no connection. Safe to try again. */
  | "failed";

export async function sendWithCsrf(
  method: "POST" | "DELETE",
  path: string,
  csrfToken: string,
  fetcher: typeof fetch = fetch,
): Promise<MutationResult> {
  try {
    const response = await fetcher(path, {
      method,
      headers: { "X-CSRF-Token": csrfToken },
      credentials: "same-origin",
    });
    if (response.ok) return "ok";
    if (response.status === 401) return "signed-out";
    if (response.status === 403) return "stale";
    return "failed";
  } catch {
    return "failed";
  }
}

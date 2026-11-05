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

// ------------------------------------------------------------------------------------------------
// Requests that send and receive JSON, for forms. Errors are mapped to fixed, friendly messages:
// nothing the person typed (and nothing the server echoes) is ever shown back as raw text, except
// the API's own authored messages for the few cases where they are the best explanation.
// ------------------------------------------------------------------------------------------------

export type FailureKind =
  | "signed-out"
  | "stale"
  | "not-found"
  | "limit"
  | "conflict"
  | "invalid"
  | "rate-limited"
  | "failed";

export interface Failure {
  ok: false;
  kind: FailureKind;
  /** A sentence that is safe to show. */
  message: string;
  /** Per-field messages for `invalid`, keyed by the API field name. */
  fields: Record<string, string>;
}

export interface Success<T> {
  ok: true;
  data: T;
  /** True when the server created something new (201), false for a repeat (200). */
  created: boolean;
}

export type JsonResult<T> = Success<T> | Failure;

const FIELD_MESSAGES: Record<string, string> = {
  amount: "Enter an amount above zero, with at most 18 decimals.",
  cost: "Enter what you paid in US dollars, with at most 2 decimals, or leave it empty.",
};

const MESSAGES: Record<Exclude<FailureKind, "invalid">, string> = {
  "signed-out": "Your session has ended. Sign in again to continue.",
  stale: "This page is out of date. Reload it and try again.",
  "not-found": "We could not find that.",
  limit: "You have reached a limit.",
  conflict: "That conflicts with what is already saved.",
  "rate-limited": "You are making changes too quickly. Wait a moment and try again.",
  failed: "Something went wrong. Please try again.",
};

function failure(
  kind: FailureKind,
  message?: string,
  fields: Record<string, string> = {},
): Failure {
  const text = message ?? (kind === "invalid" ? "Check the highlighted fields." : MESSAGES[kind]);
  return { ok: false, kind, message: text, fields };
}

type ErrorBody = {
  error?: {
    code?: string;
    message?: string;
    details?: { loc?: unknown[]; type?: string }[];
  };
};

async function readError(response: Response): Promise<ErrorBody["error"]> {
  try {
    return ((await response.json()) as ErrorBody).error;
  } catch {
    return undefined;
  }
}

/** The API's own message is shown only for these codes, whose text is authored and fixed. */
const AUTHORED = new Set(["limit_reached", "conflict", "bad_request"]);

export async function sendJson<T = unknown>(
  method: "POST" | "PUT" | "DELETE",
  path: string,
  csrfToken: string,
  options: { body?: unknown; fetcher?: typeof fetch } = {},
): Promise<JsonResult<T>> {
  const { body, fetcher = fetch } = options;
  const headers: Record<string, string> = { "X-CSRF-Token": csrfToken };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetcher(path, {
      method,
      headers,
      credentials: "same-origin",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return failure("failed");
  }

  if (response.ok) {
    const data =
      response.status === 204 ? undefined : ((await response.json().catch(() => undefined)) as T);
    return { ok: true, data: data as T, created: response.status === 201 };
  }

  const error = await readError(response);
  const authored = error?.code && AUTHORED.has(error.code) ? error.message : undefined;
  switch (response.status) {
    case 400:
      return failure("invalid", authored);
    case 401:
      return failure("signed-out");
    case 403:
      return failure("stale");
    case 404:
      return failure("not-found");
    case 409:
      return failure(error?.code === "limit_reached" ? "limit" : "conflict", authored);
    case 422: {
      const fields: Record<string, string> = {};
      for (const detail of error?.details ?? []) {
        const loc = detail.loc ?? [];
        const name = loc.at(-1);
        if (typeof name !== "string" || !(name in FIELD_MESSAGES)) continue;
        fields[name] = FIELD_MESSAGES[name]!;
      }
      return failure("invalid", undefined, fields);
    }
    case 429:
      return failure("rate-limited");
    default:
      return failure("failed");
  }
}

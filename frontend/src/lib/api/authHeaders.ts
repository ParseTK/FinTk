import "server-only";
import { cookies } from "next/headers";

/** The API's session cookie, by its development and production (__Host- prefixed) names. */
const SESSION_COOKIES = ["__Host-fintk_session", "fintk_session"] as const;

/**
 * Headers that let a server component act as the visitor when it calls the API.
 *
 * Only our own session cookie is forwarded, never anything else the browser sent, and nothing is
 * returned for an anonymous visitor. Use it with `privateApi` (never cached): a response that
 * depends on who is asking must not be shared.
 */
export async function authHeaders(): Promise<Record<string, string>> {
  const jar = await cookies();
  const forwarded = SESSION_COOKIES.flatMap((name) => {
    const value = jar.get(name)?.value;
    return value ? [`${name}=${value}`] : [];
  }).join("; ");
  return forwarded ? { cookie: forwarded } : {};
}

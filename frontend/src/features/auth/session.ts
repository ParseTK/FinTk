import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { privateApi } from "@/lib/api/client";
import { SIGNED_OUT, type SessionInfo } from "./types";

/** The API's session cookie, by its development and production (__Host- prefixed) names. */
const SESSION_COOKIES = ["__Host-virello_session", "virello_session"] as const;

/**
 * Who is visiting, asked of the API once per request (React's cache dedupes the many components
 * that want to know). Only our own session cookie is forwarded, nothing else the browser sent, and
 * the answer is never cached because it differs for every visitor.
 *
 * Fails soft: if the API is down the visitor is treated as signed out and `reachable` is false, so
 * the header still renders and pages can explain, instead of the whole site erroring.
 */
export const getSession = cache(async (): Promise<SessionInfo> => {
  const jar = await cookies();
  const forwarded = SESSION_COOKIES.flatMap((name) => {
    const value = jar.get(name)?.value;
    return value ? [`${name}=${value}`] : [];
  }).join("; ");

  try {
    const { data } = await privateApi.GET("/api/v1/auth/session", {
      headers: forwarded ? { cookie: forwarded } : {},
    });
    if (!data) return { ...SIGNED_OUT, reachable: false };
    return {
      user: data.user ?? null,
      csrfToken: data.csrf_token ?? null,
      providers: data.providers,
      reachable: true,
    };
  } catch {
    return { ...SIGNED_OUT, reachable: false };
  }
});

import "server-only";
import { cache } from "react";
import { authHeaders } from "@/lib/api/authHeaders";
import { quickApi } from "@/lib/api/client";
import { SIGNED_OUT, type SessionInfo } from "./types";

/**
 * Who is visiting, asked of the API once per request (React's cache dedupes the many components
 * that want to know). Only our own session cookie is forwarded, nothing else the browser sent, and
 * the answer is never cached because it differs for every visitor.
 *
 * Fails soft: if the API is down the visitor is treated as signed out and `reachable` is false, so
 * the header still renders and pages can explain, instead of the whole site erroring.
 */
export const getSession = cache(async (): Promise<SessionInfo> => {
  try {
    const { data } = await quickApi.GET("/api/v1/auth/session", {
      headers: await authHeaders(),
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

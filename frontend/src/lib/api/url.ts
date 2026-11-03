/**
 * Where the FastAPI service lives. Server-side only: browsers reach it through the request proxy
 * (src/proxy.ts), never directly. Read at call time so a changed environment variable applies
 * without a rebuild. No server-only import here: the proxy shares this file.
 */
export const apiBaseUrl = (env: Record<string, string | undefined> = process.env) =>
  env.API_URL ?? "http://localhost:8000";

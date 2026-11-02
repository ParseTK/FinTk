import "server-only";

/**
 * Server components import flags from here. The definitions live in flag-core.ts so the request
 * proxy (which cannot import server-only) can read the same registry.
 */
export * from "./flag-core";

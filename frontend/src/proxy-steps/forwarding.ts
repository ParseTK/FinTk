import { isEnabled, type FlagName } from "@/lib/flag-core";

/**
 * API paths a browser may reach through the proxy, and the flags that switch them on.
 *
 * Sign-in calls pass in every method. The holdings and watchlist are different: a browser may only
 * WRITE them (PUT, DELETE, which answer with what the person entered and nothing else). Reading
 * them returns the data provider's prices, which our licence allows only inside our own pages, so
 * those reads are made by the website server and are not forwarded for browsers at all.
 */
const FORWARDED = [
  {
    flags: ["auth"],
    exact: ["/api/v1/me"],
    prefixes: ["/api/v1/auth/"],
    methods: null,
  },
  {
    flags: ["auth", "crypto", "holdings"],
    exact: [],
    prefixes: ["/api/v1/watchlist/", "/api/v1/portfolio/"],
    methods: ["PUT", "DELETE"],
  },
] as const satisfies ReadonlyArray<{
  flags: readonly FlagName[];
  exact: readonly string[];
  prefixes: readonly string[];
  methods: readonly string[] | null;
}>;

/** Whether a browser call to this API path, with this method, is forwarded (given the flags). */
export function isForwardedApiPath(pathname: string, method = "GET"): boolean {
  return FORWARDED.some(
    (rule) =>
      rule.flags.every((flag) => isEnabled(flag)) &&
      (rule.methods === null || (rule.methods as readonly string[]).includes(method)) &&
      ((rule.exact as readonly string[]).includes(pathname) ||
        rule.prefixes.some((prefix) => pathname.startsWith(prefix))),
  );
}

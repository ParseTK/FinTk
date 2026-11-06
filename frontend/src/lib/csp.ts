/**
 * The Content-Security-Policy: what a page may load and run, so an injected script has nowhere to go.
 *
 * Framework-free on purpose (no Next imports) so it is unit-tested and the proxy only wires it in.
 * Scripts need the per-request nonce (plus 'strict-dynamic', which lets those trusted scripts load
 * the framework's own chunks; it does not trust injected markup, which is the attack that matters).
 * Everything else is same-origin: the site embeds no outside images,
 * fonts, frames or scripts, and links to other sites are plain anchors, which a CSP does not govern.
 *
 * Styles keep 'unsafe-inline' because React writes a few style attributes (animation offsets) and a
 * nonce cannot cover an attribute. Script injection is the risk a CSP is here to stop, and that
 * directive stays strict.
 */

export type CspMode = "enforce" | "report-only" | "off";

/** CSP_MODE=report-only logs violations in the browser without blocking; off removes the header. */
export function cspMode(value: string | undefined = process.env.CSP_MODE): CspMode {
  const mode = value?.trim().toLowerCase();
  return mode === "report-only" || mode === "off" ? mode : "enforce";
}

/** A fresh, unguessable value per request (128 bits, base64). */
export function newNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * Whether the visitor reached us over https: the address says so, or the proxy in front (which
 * terminates TLS) says so in x-forwarded-proto. A visitor can set that header on their own request,
 * but it only changes the policy on their own response, so there is nothing to gain by lying.
 */
export function requestIsHttps(headers: Headers, url: string): boolean {
  const forwarded = headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  return forwarded ? forwarded === "https" : url.startsWith("https:");
}

export interface CspOptions {
  /** The dev server's hot reload evaluates code. Default: not a production build. */
  development?: boolean;
  /**
   * Ask the browser to upgrade any http request to https. Only sensible when the page itself came
   * over https: on a plain-http run (a local production build, a container behind no TLS) the
   * upgrade would break the site's own prefetches. Default: off.
   */
  https?: boolean;
}

export function buildCsp(
  nonce: string,
  { development = process.env.NODE_ENV !== "production", https = false }: CspOptions = {},
) {
  const directives: Array<[string, string[]]> = [
    ["default-src", ["'self'"]],
    // The dev server's hot reload evaluates code; production never does.
    [
      "script-src",
      ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(development ? ["'unsafe-eval'"] : [])],
    ],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", ["'self'", "data:", "blob:"]],
    ["font-src", ["'self'"]],
    ["connect-src", ["'self'"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", ["'none'"]],
  ];
  const parts = directives.map(([name, values]) => `${name} ${values.join(" ")}`);
  if (https) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

/** The response header that carries the policy, or null when it is switched off. */
export function cspHeaderName(mode: CspMode): string | null {
  if (mode === "off") return null;
  return mode === "report-only" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";
}

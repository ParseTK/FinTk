import { buildCsp, cspHeaderName, cspMode, newNonce, requestIsHttps } from "@/lib/csp";

/**
 * The Content-Security-Policy for one page request: a fresh nonce, the request headers that carry
 * it to the page, and a function that puts the policy on the response.
 *
 * Next reads the nonce out of the request's policy and stamps it on its own scripts; the layout
 * reads x-nonce for the one inline script it writes itself. With CSP_MODE=off nothing is added.
 * The https upgrade is asked for only when the page itself came over https.
 */
export function pagePolicy(incoming: Headers, url: string) {
  const name = cspHeaderName(cspMode());
  const nonce = newNonce();
  const policy = name ? buildCsp(nonce, { https: requestIsHttps(incoming, url) }) : null;
  const headers = new Headers(incoming);
  if (name && policy) {
    headers.set(name, policy);
    headers.set("x-nonce", nonce);
  }
  return {
    headers,
    attach(response: Response) {
      if (name && policy) response.headers.set(name, policy);
    },
  };
}

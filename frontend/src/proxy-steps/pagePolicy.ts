import { buildCsp, cspHeaderName, cspMode, newNonce } from "@/lib/csp";

/**
 * The Content-Security-Policy for one page request: a fresh nonce, the request headers that carry
 * it to the page, and a function that puts the policy on the response.
 *
 * Next reads the nonce out of the request's policy and stamps it on its own scripts; the layout
 * reads x-nonce for the one inline script it writes itself. With CSP_MODE=off nothing is added.
 */
export function pagePolicy(incoming: Headers) {
  const name = cspHeaderName(cspMode());
  const nonce = newNonce();
  const policy = name ? buildCsp(nonce) : null;
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

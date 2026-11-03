/**
 * A full page load, not a client-side transition: after signing in or out the server components
 * must run again to see the new cookie. Kept in its own module so tests can replace it.
 */
export function goTo(path: string): void {
  window.location.assign(path);
}

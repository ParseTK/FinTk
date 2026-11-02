/** Motion helpers. Browser-only; call from effects and event handlers, not during render. */

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Runs `update` inside a View Transition (a cross-fade) when the browser supports it and the
 * visitor has not asked for reduced motion; otherwise runs it immediately.
 */
export function withViewTransition(update: () => void) {
  const start = (
    document as Document & { startViewTransition?: (callback: () => void) => unknown }
  ).startViewTransition?.bind(document);

  if (start && !prefersReducedMotion()) {
    start(update);
  } else {
    update();
  }
}

/** Stagger delay for the nth item of a list, capped so long lists never feel slow. */
export function staggerDelay(index: number, stepMs = 50, maxMs = 400): string {
  return `${Math.min(index * stepMs, maxMs)}ms`;
}

/** Motion helpers. Browser-only; call from effects and event handlers, not during render. */

/**
 * True when motion should be off: the visitor chose "Reduced" in the palette, or (before they have
 * chosen) their device asks for reduced motion.
 */
export function isMotionOff(): boolean {
  const chosen = document.documentElement.dataset.motion;
  if (chosen === "reduced") return true;
  if (chosen === "full") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Runs `update` inside a View Transition (a cross-fade) when the browser supports it and motion is
 * on; otherwise runs it immediately.
 */
export function withViewTransition(update: () => void) {
  const start = (
    document as Document & { startViewTransition?: (callback: () => void) => unknown }
  ).startViewTransition?.bind(document);

  if (start && !isMotionOff()) {
    start(update);
  } else {
    update();
  }
}

/** Stagger delay for the nth item of a list, capped so long lists never feel slow. */
export function staggerDelay(index: number, stepMs = 50, maxMs = 400): string {
  return `${Math.min(index * stepMs, maxMs)}ms`;
}

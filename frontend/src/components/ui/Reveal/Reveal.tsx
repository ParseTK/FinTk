"use client";

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { isMotionOff } from "@/lib/motion";

export interface RevealProps {
  children: ReactNode;
  as?: "div" | "li";
  className?: string;
  style?: CSSProperties;
  /** Position in a row of siblings: each one starts `index * stagger` ms after the previous. */
  index?: number;
  /** Delay between siblings, in ms. */
  stagger?: number;
  /** Render a plain element with no entrance at all (feature flag, tests). */
  disabled?: boolean;
}

const DURATION_MS = 750;
const EASING = "cubic-bezier(0.16, 1, 0.3, 1)"; // the same ease-out as the rest of the site
const RISE_PX = 36;

/**
 * A choreographed entrance: when the element first scrolls into view it fades in, rises a little
 * and settles, once. Siblings pass an `index` so a row plays left to right.
 *
 * It is progressive and safe by construction:
 *  - the server renders the element fully visible, so there is no JavaScript-off penalty;
 *  - an element already on screen at load is left alone (no flash);
 *  - only elements below the fold are hidden, before first paint, so nothing visible ever flickers;
 *  - it does nothing at all when Motion is Reduced (or the device asks for reduced motion);
 *  - while hidden it is also visibility:hidden, so it is not announced or tabbed to before it appears.
 */
export function Reveal({
  children,
  as: Tag = "div",
  className,
  style,
  index = 0,
  stagger = 110,
  disabled = false,
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || disabled || isMotionOff()) return;
    if (typeof IntersectionObserver === "undefined" || typeof element.animate !== "function")
      return;

    // Already on screen: leave it exactly as rendered.
    if (element.getBoundingClientRect().top < window.innerHeight * 0.9) return;

    element.style.opacity = "0";
    element.style.visibility = "hidden";

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        element.style.visibility = "";
        element.style.opacity = "";
        element.animate(
          [
            { opacity: 0, transform: `translateY(${RISE_PX}px) scale(0.97)` },
            { opacity: 1, transform: "none" },
          ],
          {
            duration: DURATION_MS,
            delay: index * stagger,
            easing: EASING,
            // Hold the first frame during the stagger delay so the element does not flash.
            fill: "backwards",
          },
        );
      },
      // Fire a little before the element is fully on screen.
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    observer.observe(element);

    return () => {
      observer.disconnect();
      element.style.opacity = "";
      element.style.visibility = "";
    };
  }, [disabled, index, stagger]);

  // The ref type is HTMLElement for both tags; the cast keeps the polymorphic tag simple.
  return (
    <Tag ref={ref as never} className={className} style={style}>
      {children}
    </Tag>
  );
}

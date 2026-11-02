"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from "react";

/**
 * Behavior shared by every "button that opens a panel" (palette picker, mobile menu):
 * Escape closes and returns focus to the button, clicking outside closes, and tabbing out of the
 * panel closes. Spread `containerProps` on the wrapper that holds both the button and the panel.
 */
export function useDisclosure() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const close = useCallback((returnFocus = false) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);
  const toggle = useCallback(() => setOpen((value) => !value), []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, close]);

  const containerProps = {
    ref: containerRef,
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) {
        event.stopPropagation();
        close(true);
      }
    },
    onBlur: (event: FocusEvent) => {
      if (open && !containerRef.current?.contains(event.relatedTarget as Node | null)) close();
    },
  };

  return { open, toggle, close, buttonRef, containerProps };
}

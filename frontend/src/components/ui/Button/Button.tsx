"use client";

import clsx from "clsx";
import type { ComponentProps } from "react";
import { buttonStyles, type ButtonStyleOptions } from "./button-styles";

export interface ButtonProps
  extends ComponentProps<"button">, Omit<ButtonStyleOptions, "className"> {
  /**
   * Marks the button busy and ignores presses until it clears. Keep the label so the button keeps
   * its name. It is NOT given the `disabled` attribute: a button that becomes disabled loses
   * keyboard focus, and nothing puts it back, so a keyboard or screen-reader user would be thrown
   * to the top of the page after every save, toggle or delete.
   */
  loading?: boolean;
}

export function Button({
  variant,
  size,
  fullWidth,
  loading = false,
  className,
  type = "button",
  disabled,
  onClick,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      onClick={(event) => {
        // preventDefault also stops a submit button from submitting the form a second time.
        if (loading) event.preventDefault();
        else onClick?.(event);
      }}
      className={buttonStyles({
        variant,
        size,
        fullWidth,
        className: clsx(loading && "pointer-events-none opacity-50", className),
      })}
      {...rest}
    >
      {loading && (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          className="size-4 animate-spin"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        >
          <path d="M12 3a9 9 0 1 0 9 9" />
        </svg>
      )}
      {children}
    </button>
  );
}

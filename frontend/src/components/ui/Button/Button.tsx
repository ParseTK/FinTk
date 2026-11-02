import type { ComponentProps } from "react";
import { buttonStyles, type ButtonStyleOptions } from "./button-styles";

export interface ButtonProps
  extends ComponentProps<"button">, Omit<ButtonStyleOptions, "className"> {
  /** Disables the button and marks it busy. Keep the label so the button keeps its name. */
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
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonStyles({ variant, size, fullWidth, className })}
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

import clsx from "clsx";
import type { ComponentProps } from "react";
import { buttonStyles, type ButtonStyleOptions } from "./button-styles";

export interface IconButtonProps
  extends
    Omit<ComponentProps<"button">, "aria-label" | "children">,
    Omit<ButtonStyleOptions, "className" | "fullWidth"> {
  /** Required: an icon-only control has no visible text, so it needs an accessible name. */
  label: string;
  /** The icon, which must be decorative (aria-hidden). */
  children: React.ReactNode;
}

const SQUARE = { sm: "size-8", md: "size-10", lg: "size-12" } as const;

export function IconButton({
  label,
  variant = "ghost",
  size = "md",
  className,
  type = "button",
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={clsx(buttonStyles({ variant, size, className }), "p-0", SQUARE[size])}
      {...rest}
    >
      {children}
    </button>
  );
}

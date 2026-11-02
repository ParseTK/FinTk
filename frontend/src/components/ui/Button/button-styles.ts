import clsx from "clsx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition duration-150 disabled:cursor-not-allowed disabled:opacity-50 motion-safe:enabled:active:scale-[0.97]";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-on-accent hover:opacity-90 motion-safe:enabled:hover:-translate-y-px enabled:hover:shadow-[0_8px_24px_-8px_color-mix(in_oklab,var(--brand)_70%,transparent)]",
  secondary: "border border-border-strong bg-surface text-fg hover:bg-surface-raised",
  ghost: "text-fg hover:bg-surface-raised",
  danger: "bg-loss text-on-accent hover:opacity-90",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-base",
  lg: "px-6 py-3 text-lg",
};

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}

/** Shared by Button and LinkButton so a link that looks like a button is styled identically. */
export function buttonStyles({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: ButtonStyleOptions = {}) {
  return clsx(BASE, VARIANTS[variant], SIZES[size], fullWidth && "w-full", className);
}

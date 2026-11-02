import clsx from "clsx";
import type { ReactNode } from "react";

export type AlertVariant = "info" | "success" | "error";

const STYLES: Record<AlertVariant, { border: string; icon: string; glyph: string; label: string }> =
  {
    info: { border: "border-l-brand", icon: "text-brand", glyph: "i", label: "Information" },
    success: { border: "border-l-gain", icon: "text-gain", glyph: "✓", label: "Success" },
    error: { border: "border-l-loss", icon: "text-loss", glyph: "!", label: "Error" },
  };

export interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children?: ReactNode;
  className?: string;
}

/** The kind of message is stated in text for screen readers and shown with a glyph, not just a color. */
export function Alert({ variant = "info", title, children, className }: AlertProps) {
  const style = STYLES[variant];
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={clsx(
        "border-border bg-surface-raised flex gap-3 rounded-lg border border-l-4 p-4",
        style.border,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={clsx(
          "flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-current text-sm font-bold",
          style.icon,
        )}
      >
        {style.glyph}
      </span>
      <div className="space-y-1">
        <p className="font-semibold">
          <span className="sr-only">{style.label}: </span>
          {title}
        </p>
        {children && <div className="text-fg-muted text-sm">{children}</div>}
      </div>
    </div>
  );
}

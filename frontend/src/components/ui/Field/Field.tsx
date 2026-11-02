import clsx from "clsx";
import { useId, type ComponentProps, type ReactNode } from "react";

export function Label({ className, ...rest }: ComponentProps<"label">) {
  return <label className={clsx("text-fg block text-sm font-medium", className)} {...rest} />;
}

export interface InputProps extends ComponentProps<"input"> {
  invalid?: boolean;
}

export function Input({ invalid, className, ...rest }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={clsx(
        "border-border-strong bg-surface text-fg placeholder:text-fg-muted w-full rounded-lg border px-3 py-2",
        "aria-invalid:border-loss disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-2",
        className,
      )}
      {...rest}
    />
  );
}

/** The error text is always spelled out ("Error: ..."), never conveyed by color alone. */
export function FieldError({ id, children }: { id: string; children?: ReactNode }) {
  return (
    // Always rendered so assistive tech announces the message when it appears.
    <div id={id} aria-live="polite" className="text-loss text-sm">
      {children ? (
        <>
          <span className="sr-only">Error:</span> {children}
        </>
      ) : null}
    </div>
  );
}

export interface TextFieldProps extends Omit<InputProps, "invalid"> {
  label: string;
  hint?: string;
  error?: string;
}

/** Label + input + hint + error, wired together with ids so screen readers get all of it. */
export function TextField({ label, hint, error, id, className, ...rest }: TextFieldProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy = clsx(hint && hintId, error && errorId) || undefined;

  return (
    <div className={clsx("space-y-1.5", className)}>
      <Label htmlFor={inputId}>{label}</Label>
      {hint && (
        <p id={hintId} className="text-fg-muted text-sm">
          {hint}
        </p>
      )}
      <Input id={inputId} invalid={Boolean(error)} aria-describedby={describedBy} {...rest} />
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  );
}

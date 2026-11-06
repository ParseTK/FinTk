/**
 * FinTk mark: "TK" on a rounded square. Decorative; the wordmark next to it carries the name. The
 * letters are drawn as strokes (no font involved), so the mark looks the same everywhere.
 */
export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" className={className}>
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <path
        d="M5.5 10h9M10 10v12.5M18.5 10v12.5M18.5 16.5 26 10M21.7 14l4.8 8.5"
        fill="none"
        className="stroke-on-accent"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="text-brand inline-flex items-center gap-2">
      <LogoMark />
      <span className="text-fg text-xl font-semibold tracking-tight">FinTk</span>
    </span>
  );
}

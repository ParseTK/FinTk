/** Virello mark: a "V" on a rounded square. Decorative; the wordmark next to it carries the name. */
export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" className={className}>
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <path
        d="M8.5 9.5 16 23l7.5-13.5"
        fill="none"
        stroke="#fff"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="text-brand-dark inline-flex items-center gap-2">
      <LogoMark />
      <span className="text-xl font-semibold tracking-tight text-black">Virello</span>
    </span>
  );
}

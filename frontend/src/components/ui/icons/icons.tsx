/** Decorative icons (aria-hidden). Pair them with visible text or an accessible name on the control. */

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
} as const;

export function SearchIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function PaletteIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <circle cx="13.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="10.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="6.5" cy="12.5" r="1" fill="currentColor" stroke="none" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
    </svg>
  );
}

export function MenuIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function PauseIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <path d="M8 5v14M16 5v14" />
    </svg>
  );
}

export function PlayIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <path d="M7 4.5v15l12-7.5z" />
    </svg>
  );
}

export function CheckIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function PlusIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function CloseIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function ChevronDownIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function BookIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z" />
      <path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

export function LandmarkIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <path d="M3 21h18M5 21V10m4 11V10m6 11V10m4 11V10M2 10l10-7 10 7z" />
    </svg>
  );
}

export function SlidersIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <path d="M4 6h10m4 0h2M4 12h4m4 0h8M4 18h12m4 0h0" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  );
}

export function DocumentIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
      <path d="M14 2v5h5" />
    </svg>
  );
}

export function ArrowUpRightIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  );
}

/** The GitHub mark (filled, unlike the outline icons above). */
export function GitHubIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable={false}
      className={className}
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.68.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

export function GlobeIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
    </svg>
  );
}

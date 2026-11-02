"use client";

import { useEffect, useId, useRef, useState } from "react";
import { SearchIcon } from "@/components/ui/icons";
import { useTypewriterPlaceholder } from "./useTypewriterPlaceholder";

interface SearchFormProps {
  defaultValue?: string;
  /** `lg` is the hero version; `md` is the compact one used on the results page. */
  size?: "md" | "lg";
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/**
 * Plain GET form: works without JS, is shareable by URL, and results render on the server.
 * Pressing "/" anywhere on the page focuses the field. While idle, the placeholder types out
 * example company names.
 */
export function SearchForm({ defaultValue = "", size = "md" }: SearchFormProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [hasText, setHasText] = useState(defaultValue !== "");
  const placeholder = useTypewriterPlaceholder(focused || hasText);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const large = size === "lg";

  // Sizes step up with the field's own width (container queries), so a narrow field never clips.
  return (
    <form action="/search" role="search" className="@container w-full max-w-2xl">
      <label htmlFor={inputId} className="sr-only">
        Search companies
      </label>
      <div
        className={`group border-border-strong bg-surface focus-within:border-brand flex items-center gap-2 rounded-full border shadow-sm transition-[box-shadow,border-color] duration-300 focus-within:shadow-[0_0_0_4px_color-mix(in_oklab,var(--brand)_22%,transparent)] hover:shadow-md @md:gap-3 ${
          large ? "py-1.5 pr-1.5 pl-4 @md:py-2 @md:pr-2 @md:pl-6" : "py-1.5 pr-1.5 pl-4 @md:pl-5"
        }`}
      >
        <SearchIcon className="text-fg-muted group-focus-within:text-brand size-5 shrink-0 transition-colors duration-300" />
        <input
          ref={inputRef}
          id={inputId}
          name="q"
          type="search"
          defaultValue={defaultValue}
          placeholder={placeholder}
          maxLength={64}
          autoComplete="off"
          enterKeyHint="search"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(event) => setHasText(event.target.value !== "")}
          className={`placeholder:text-fg-muted text-fg min-w-0 flex-1 bg-transparent text-base focus-visible:outline-none ${
            large ? "py-2 @md:text-lg" : "py-1.5"
          }`}
        />
        <kbd
          aria-hidden="true"
          className="border-border text-fg-muted hidden rounded-md border px-2 py-0.5 text-xs font-medium @lg:block"
        >
          /
        </kbd>
        <button
          type="submit"
          className={`bg-brand text-on-accent rounded-full font-semibold transition duration-150 hover:opacity-90 motion-safe:active:scale-[0.96] ${
            large ? "px-5 py-2.5 @md:px-6 @md:py-3" : "px-5 py-2"
          }`}
        >
          Search
        </button>
      </div>
    </form>
  );
}

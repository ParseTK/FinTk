"use client";

import { useEffect, useId, useRef } from "react";
import { SearchIcon } from "./icons";

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
 * Pressing "/" anywhere on the page focuses the field.
 */
export function SearchForm({ defaultValue = "", size = "md" }: SearchFormProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <form action="/search" role="search" className="@container w-full max-w-2xl">
      <label htmlFor={inputId} className="sr-only">
        Search companies
      </label>
      <div
        className={`border-border-strong bg-surface focus-within:border-brand focus-within:ring-brand flex items-center gap-3 rounded-full border shadow-sm transition-shadow focus-within:ring-2 hover:shadow-md ${
          large ? "py-2 pr-2 pl-6" : "py-1.5 pr-1.5 pl-5"
        }`}
      >
        <SearchIcon className="text-fg-muted size-5 shrink-0" />
        <input
          ref={inputRef}
          id={inputId}
          name="q"
          type="search"
          defaultValue={defaultValue}
          placeholder="Search companies or tickers"
          maxLength={64}
          autoComplete="off"
          enterKeyHint="search"
          className={`placeholder:text-fg-muted text-fg min-w-0 flex-1 bg-transparent focus-visible:outline-none ${
            large ? "py-2 text-lg" : "py-1.5"
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
          className={`bg-brand text-on-accent rounded-full font-semibold transition-opacity hover:opacity-90 ${
            large ? "px-6 py-3" : "px-5 py-2"
          }`}
        >
          Search
        </button>
      </div>
    </form>
  );
}

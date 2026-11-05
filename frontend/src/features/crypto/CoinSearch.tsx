"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { findCoins, type CoinSuggestion } from "./actions";

const DEBOUNCE_MS = 150;

type Status = "idle" | "loading" | "done";

/**
 * Search for a coin by name or symbol, with suggestions. An editable combobox with a list popup
 * (WAI-ARIA 1.2): the input keeps focus, the arrow keys move through the suggestions, Enter opens
 * the highlighted one, Escape closes the list. Without a highlighted suggestion Enter submits the
 * form to the search page, so it also works without JavaScript. A status line says how many
 * suggestions there are, because a screen reader cannot see the list appear. Answers that arrive
 * out of order are ignored.
 */
export function CoinSearch({ className }: { className?: string }) {
  const router = useRouter();
  const id = useId();
  const listId = `${id}-list`;
  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState<CoinSuggestion[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const latest = useRef(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = text.trim();
    const ticket = ++latest.current;
    if (query === "") return;
    const timer = setTimeout(async () => {
      setStatus("loading");
      let found: CoinSuggestion[] = [];
      try {
        found = await findCoins(query);
      } catch {
        // A failed lookup is shown as "no matches"; the search page is still one Enter away.
      }
      if (ticket !== latest.current) return; // a newer keystroke owns the list now
      setSuggestions(found);
      setActive(-1);
      setStatus("done");
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const query = text.trim();
  const showList = open && query !== "" && status === "done" && suggestions.length > 0;
  const message =
    query === "" || status !== "done"
      ? ""
      : suggestions.length === 0
        ? "No coins found. Press Enter to search the full list."
        : `${suggestions.length} ${suggestions.length === 1 ? "suggestion" : "suggestions"}. Use the up and down arrow keys, then Enter.`;

  const go = (slug: string) => {
    setOpen(false);
    setText("");
    setSuggestions([]);
    setStatus("idle");
    router.push(`/crypto/coins/${slug}`);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (suggestions.length === 0) return;
      event.preventDefault();
      setOpen(true);
      const count = suggestions.length;
      setActive((current) =>
        event.key === "ArrowDown" ? (current + 1) % count : current <= 0 ? count - 1 : current - 1,
      );
    } else if (event.key === "Enter" && showList && active >= 0 && active < suggestions.length) {
      event.preventDefault();
      go(suggestions[active]!.slug);
    } else if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        setOpen(false);
        setActive(-1);
      }
    }
  };

  return (
    <div
      ref={box}
      className={clsx("relative", className)}
      onBlur={(event) => {
        if (!box.current?.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <form role="search" action="/crypto/search" method="get">
        <label htmlFor={`${id}-input`} className="sr-only">
          Search coins by name or symbol
        </label>
        <input
          id={`${id}-input`}
          name="q"
          type="search"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          maxLength={40}
          placeholder="Search coins"
          value={text}
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${id}-option-${active}` : undefined}
          onChange={(event) => {
            setText(event.target.value);
            setOpen(true);
            setActive(-1);
            if (event.target.value.trim() === "") {
              setSuggestions([]);
              setStatus("idle");
            }
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="border-border-strong bg-surface text-fg placeholder:text-fg-muted focus-visible:outline-brand h-10 w-full rounded-lg border px-3 text-sm"
        />
      </form>
      <p role="status" className="sr-only">
        {message}
      </p>
      <ul
        id={listId}
        role="listbox"
        aria-label="Coin suggestions"
        hidden={!showList}
        className="border-border bg-surface-raised absolute inset-x-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-lg border py-1 shadow-lg"
      >
        {showList &&
          suggestions.map((coin, index) => (
            <li
              key={coin.slug}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={index === active}
              // The mouse press must not move focus out of the input, or the list would close first.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => go(coin.slug)}
              className={clsx(
                "cursor-pointer px-3 py-2 text-sm",
                index === active ? "bg-brand text-on-accent" : "hover:bg-surface",
              )}
            >
              {/* One text run with a real space, so the name reads "Bitcoin BTC", not "BitcoinBTC". */}
              <span className="font-medium">{coin.name}</span>{" "}
              <span className={index === active ? "" : "text-fg-muted"}>{coin.symbol}</span>
            </li>
          ))}
      </ul>
    </div>
  );
}

"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import type { CoinSuggestion } from "./actions";
import { useCoinLookup, type LookupStatus } from "./useCoinLookup";

export type { CoinSuggestion };

/** What a screen reader is told about the list, which it cannot see appear. Empty when nothing changed. */
function suggestionMessage(query: string, status: LookupStatus, count: number): string {
  if (query === "" || status !== "done") return "";
  if (count === 0) return "No coins found. Press Enter to search the full list.";
  const noun = count === 1 ? "suggestion" : "suggestions";
  return `${count} ${noun}. Use the up and down arrow keys, then Enter.`;
}

/** The highlighted suggestion after an arrow key: down wraps to the first, up wraps to the last. */
function nextActive(key: "ArrowDown" | "ArrowUp", current: number, count: number): number {
  if (key === "ArrowDown") return (current + 1) % count;
  return current <= 0 ? count - 1 : current - 1;
}

/** The popup list. A mouse press must not move focus out of the input, or the list would close first. */
function SuggestionList({
  id,
  listId,
  suggestions,
  active,
  show,
  onChoose,
}: {
  id: string;
  listId: string;
  suggestions: CoinSuggestion[];
  active: number;
  show: boolean;
  onChoose: (coin: CoinSuggestion) => void;
}) {
  return (
    <ul
      id={listId}
      role="listbox"
      aria-label="Coin suggestions"
      hidden={!show}
      className="border-border bg-surface-raised absolute inset-x-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-lg border py-1 shadow-lg"
    >
      {show &&
        suggestions.map((coin, index) => (
          <li
            key={coin.slug}
            id={`${id}-option-${index}`}
            role="option"
            aria-selected={index === active}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onChoose(coin)}
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
  );
}

/**
 * Search for a coin by name or symbol, with suggestions. An editable combobox with a list popup
 * (WAI-ARIA 1.2): the input keeps focus, the arrow keys move through the suggestions, Enter opens
 * the highlighted one, Escape closes the list. Without a highlighted suggestion Enter submits the
 * form to the search page, so it also works without JavaScript. A status line says how many
 * suggestions there are, because a screen reader cannot see the list appear. Answers that arrive
 * out of order are ignored.
 */
export function CoinSearch({
  className,
  onPick,
  label = "Search coins by name or symbol",
  placeholder = "Search coins",
}: {
  className?: string;
  /** Used as a picker: choosing a suggestion calls this instead of opening the coin page. */
  onPick?: (coin: CoinSuggestion) => void;
  label?: string;
  placeholder?: string;
}) {
  const router = useRouter();
  const id = useId();
  const listId = `${id}-list`;
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLDivElement>(null);
  const { suggestions, status, clear } = useCoinLookup(text, () => setActive(-1));

  const query = text.trim();
  const showList = open && query !== "" && status === "done" && suggestions.length > 0;
  const message = suggestionMessage(query, status, suggestions.length);

  const go = (coin: CoinSuggestion) => {
    setOpen(false);
    setText("");
    clear();
    if (onPick) onPick(coin);
    else router.push(`/crypto/coins/${coin.slug}`);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (suggestions.length === 0) return;
      event.preventDefault();
      setOpen(true);
      const { key } = event;
      setActive((current) => nextActive(key, current, suggestions.length));
    } else if (event.key === "Enter" && showList && active >= 0 && active < suggestions.length) {
      event.preventDefault();
      go(suggestions[active]!);
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
      <form
        role={onPick ? undefined : "search"}
        action={onPick ? undefined : "/crypto/search"}
        method={onPick ? undefined : "get"}
        onSubmit={
          onPick
            ? (event) => {
                // A picker has no results page: Enter chooses the highlighted (or first) suggestion.
                event.preventDefault();
                const choice = suggestions[Math.max(active, 0)];
                if (showList && choice) go(choice);
              }
            : undefined
        }
      >
        <label htmlFor={`${id}-input`} className="sr-only">
          {label}
        </label>
        <input
          id={`${id}-input`}
          name="q"
          type="search"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          maxLength={40}
          placeholder={placeholder}
          value={text}
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${id}-option-${active}` : undefined}
          onChange={(event) => {
            setText(event.target.value);
            setOpen(true);
            setActive(-1);
            if (event.target.value.trim() === "") clear();
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="border-border-strong bg-surface text-fg placeholder:text-fg-muted focus-visible:outline-brand h-10 w-full rounded-lg border px-3 text-sm"
        />
      </form>
      <p role="status" className="sr-only">
        {message}
      </p>
      <SuggestionList
        id={id}
        listId={listId}
        suggestions={suggestions}
        active={active}
        show={showList}
        onChoose={go}
      />
    </div>
  );
}

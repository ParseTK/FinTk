"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CoinSearch, type CoinSuggestion } from "./CoinSearch";

export interface PickedCoin {
  slug: string;
  /** What to call it on screen, for example "Bitcoin BTC". */
  label: string;
}

/**
 * Chooses up to `max` coins and keeps the choice in the address (`?param=bitcoin,ethereum`), so the
 * page that shows them stays a plain server-rendered page and a choice can be shared as a link. It
 * only ever puts coin names in the address, never figures. Adding and removing is announced in a
 * status line, and each chosen coin has its own Remove button, so nothing depends on a mouse.
 */
export function CoinPicker({
  selected,
  max,
  basePath,
  param,
  hash,
}: {
  selected: readonly PickedCoin[];
  max: number;
  basePath: string;
  param: string;
  hash: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  const go = (slugs: string[]) => {
    const query = slugs.length > 0 ? `?${param}=${slugs.join(",")}` : "";
    router.replace(`${basePath}${query}#${hash}`, { scroll: false });
  };

  const add = (coin: CoinSuggestion) => {
    if (selected.some((item) => item.slug === coin.slug)) {
      setMessage(`${coin.name} is already in the comparison.`);
      return;
    }
    if (selected.length >= max) return;
    const count = selected.length + 1;
    setMessage(`Added ${coin.name}. ${count} ${count === 1 ? "coin" : "coins"} selected.`);
    go([...selected.map((item) => item.slug), coin.slug]);
  };

  const remove = (coin: PickedCoin) => {
    const count = selected.length - 1;
    setMessage(`Removed ${coin.label}. ${count} ${count === 1 ? "coin" : "coins"} selected.`);
    go(selected.filter((item) => item.slug !== coin.slug).map((item) => item.slug));
  };

  return (
    <div className="space-y-3">
      {selected.length < max ? (
        <CoinSearch
          onPick={add}
          label={`Add a coin to compare (up to ${max})`}
          placeholder="Add a coin to compare"
          className="max-w-sm"
        />
      ) : (
        <p className="text-fg-muted text-sm">
          {max} coins is the most that can be compared. Remove one to add another.
        </p>
      )}
      {selected.length > 0 && (
        <ul aria-label="Coins being compared" className="flex flex-wrap gap-2">
          {selected.map((coin) => (
            <li
              key={coin.slug}
              className="border-border bg-surface-raised flex items-center gap-2 rounded-lg border py-1 pr-1 pl-3 text-sm"
            >
              <span className="font-medium">{coin.label}</span>
              <button
                type="button"
                onClick={() => remove(coin)}
                className="text-brand focus-visible:outline-brand inline-flex min-h-8 items-center rounded px-2 font-medium underline underline-offset-2 hover:no-underline"
              >
                Remove <span className="sr-only">{coin.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p role="status" className="sr-only">
        {message}
      </p>
    </div>
  );
}

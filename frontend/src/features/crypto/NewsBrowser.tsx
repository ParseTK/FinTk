"use client";

import clsx from "clsx";
import { useState } from "react";
import { formatDate } from "@/lib/format";
import { availableCategories, newestFirst, type CategoryKey } from "./newsCategories";
import type { NewsItem } from "./types";

const KIND_LABEL: Record<NewsItem["kind"], string> = {
  press_release: "Announcement",
  filing: "Filing",
};

function Headline({ item, className }: { item: NewsItem; className: string }) {
  // A link that is not https is not rendered as a link, whatever the API sent.
  return item.url.startsWith("https://") ? (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className={clsx(className, "underline-offset-2 hover:underline")}
    >
      {item.title} <span className="sr-only">(opens in a new tab)</span>
    </a>
  ) : (
    <span className={className}>{item.title}</span>
  );
}

function Meta({ item }: { item: NewsItem }) {
  return (
    <p className="text-fg-muted text-sm">
      {item.source} · <time dateTime={item.published}>{formatDate(item.published)}</time>
      {item.detail ? ` · ${item.detail}` : ""}
    </p>
  );
}

/**
 * Official announcements and filings as a reading list: category tabs, the newest story in the
 * category featured, the rest listed under "Further reading". Everything is the source's own
 * headline and date, newest first; nothing is ranked, summarised or rewritten, and "featured" only
 * means newest. The tabs are plain toggle buttons (not links), and a status line tells screen
 * readers what the list now shows.
 */
export function NewsBrowser({ items }: { items: readonly NewsItem[] }) {
  const [selected, setSelected] = useState<CategoryKey>("all");
  const categories = availableCategories(items);
  const category = categories.find((entry) => entry.key === selected) ?? categories[0]!;
  const stories = newestFirst(items.filter(category.matches));
  const [featured, ...rest] = stories;

  return (
    <div className="space-y-6">
      <div role="group" aria-label="Story type" className="flex flex-wrap gap-2">
        {categories.map(({ key, label, count }) => (
          <button
            key={key}
            type="button"
            aria-pressed={key === category.key}
            onClick={() => setSelected(key)}
            className={clsx(
              "min-h-9 rounded-lg border px-3 text-sm font-semibold transition-colors",
              key === category.key
                ? "border-brand bg-brand text-on-accent"
                : "border-border text-fg-muted hover:bg-surface-raised hover:text-fg",
            )}
          >
            {label} <span className="font-normal opacity-80">({count})</span>
          </button>
        ))}
      </div>
      <p role="status" className="sr-only">
        Showing {stories.length} {stories.length === 1 ? "story" : "stories"}: {category.label}
      </p>

      {featured && (
        <article className="border-border bg-surface-raised space-y-3 rounded-2xl border p-6 sm:p-8">
          <p className="text-brand text-xs font-semibold tracking-wide uppercase">
            Newest · {KIND_LABEL[featured.kind]}
          </p>
          <h2 className="text-2xl leading-snug font-semibold sm:text-3xl">
            <Headline item={featured} className="" />
          </h2>
          <Meta item={featured} />
        </article>
      )}

      {rest.length > 0 && (
        <section aria-labelledby="further-reading" className="space-y-1">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="further-reading" className="text-xl font-semibold">
              Further reading
            </h2>
            <p className="text-fg-muted text-sm">
              {rest.length} {rest.length === 1 ? "story" : "stories"}
            </p>
          </div>
          <ul
            aria-label="Official crypto announcements, newest first"
            className="divide-border divide-y"
          >
            {rest.map((item) => (
              <li
                key={item.url}
                className="grid gap-1 py-4 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4"
              >
                <p className="text-brand text-xs font-semibold tracking-wide uppercase sm:pt-1">
                  {KIND_LABEL[item.kind]}
                </p>
                <div className="space-y-1">
                  <Headline item={item} className="font-semibold" />
                  <Meta item={item} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

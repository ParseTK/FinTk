import { formatDate } from "@/lib/format";
import type { NewsItem } from "./types";

/**
 * Official announcements as plain entries: the source's own headline (a link out), who published
 * it, and when. Nothing is added, ranked or summarised. A link that is not https is not rendered
 * as a link, whatever the API sent.
 */
export function NewsList({ items, label }: { items: readonly NewsItem[]; label: string }) {
  return (
    <ul aria-label={label} className="divide-border divide-y">
      {items.map((item) => (
        <li key={item.url} className="space-y-1 py-3">
          {item.url.startsWith("https://") ? (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline-offset-2 hover:underline"
            >
              {item.title} <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : (
            <span className="font-semibold">{item.title}</span>
          )}
          <p className="text-fg-muted text-sm">
            {item.source} · <time dateTime={item.published}>{formatDate(item.published)}</time>
            {item.detail ? ` · ${item.detail}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}

import type { NewsItem } from "./types";

export type CategoryKey = "all" | "sec" | "cftc" | "doj" | "filings";

export interface Category {
  key: CategoryKey;
  label: string;
  matches: (item: NewsItem) => boolean;
}

/** The tabs on the news page. A story belongs to the first category whose rule it meets. */
export const CATEGORIES: readonly Category[] = [
  { key: "all", label: "All stories", matches: () => true },
  { key: "sec", label: "SEC", matches: (i) => i.kind === "press_release" && i.source === "SEC" },
  {
    key: "cftc",
    label: "CFTC",
    matches: (i) => i.kind === "press_release" && i.source.startsWith("CFTC"),
  },
  {
    key: "doj",
    label: "Justice Dept.",
    matches: (i) => i.kind === "press_release" && i.source === "Department of Justice",
  },
  { key: "filings", label: "Company filings", matches: (i) => i.kind === "filing" },
];

/** Newest first. The sort is stable, so items from the same day keep the order they came in. */
export function newestFirst(items: readonly NewsItem[]): NewsItem[] {
  return [...items].sort((a, b) => b.published.localeCompare(a.published));
}

/** The categories that have at least one story ("all" always stays), with their counts. */
export function availableCategories(
  items: readonly NewsItem[],
): Array<Category & { count: number }> {
  return CATEGORIES.map((category) => ({
    ...category,
    count: items.filter(category.matches).length,
  })).filter((category) => category.key === "all" || category.count > 0);
}

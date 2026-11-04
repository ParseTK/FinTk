import { isActivePath } from "./navigation";

/**
 * What the browser needs of a section: plain data, no flags left to evaluate. Kept apart from
 * sections.ts, which reads the flags and so must stay on the server.
 */
export interface SectionView {
  id: string;
  label: string;
  links: ReadonlyArray<{ href: string; label: string; exact?: boolean }>;
}

/** The section the current page belongs to, if any. */
export function sectionFor(
  sections: readonly SectionView[],
  pathname: string,
): SectionView | undefined {
  return sections.find((section) =>
    section.links.some((link) => isActivePath(pathname, link.href, link.exact)),
  );
}

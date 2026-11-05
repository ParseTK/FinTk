"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isActivePath } from "./navigation";
import { sectionFor, type SectionView } from "./sectionView";

/**
 * Puts the subpages of the current section beside the page: a column on wide screens, a row of
 * tabs above the page on narrow ones (never hidden in a drawer). Pages outside every section, and
 * the whole site while the shell is off (no sections are passed), are rendered untouched.
 *
 * The current page is marked with aria-current and a bar, not by colour alone. The tab row is
 * `relative` so visually hidden text inside it cannot widen the page on phones.
 */
export function SectionFrame({
  sections,
  children,
}: {
  sections: readonly SectionView[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const section = sectionFor(sections, pathname);
  if (!section) return <>{children}</>;

  return (
    // Same wide width as the header and footer. Only the left side is padded here: the page's own
    // container pads its right side, so the right edges line up with the header too.
    <div className="mx-auto w-full max-w-7xl lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-2 lg:pl-8">
      <nav
        aria-label={`${section.label} pages`}
        className="px-4 pt-2 sm:px-6 lg:sticky lg:top-4 lg:self-start lg:px-0 lg:pt-8"
      >
        <p
          aria-hidden="true"
          className="text-fg-muted hidden px-3 pb-2 text-xs font-semibold tracking-wide uppercase lg:block"
        >
          {section.label}
        </p>
        <ul className="relative flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {section.links.map(({ href, label, exact }) => {
            const active = isActivePath(pathname, href, exact);
            return (
              <li key={href} className="shrink-0">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "flex min-h-11 items-center rounded-lg border-b-2 px-3 text-sm font-semibold lg:border-b-0 lg:border-l-2",
                    active
                      ? "border-brand bg-surface-raised text-brand"
                      : "text-fg-muted hover:bg-surface-raised hover:text-fg border-transparent",
                  )}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

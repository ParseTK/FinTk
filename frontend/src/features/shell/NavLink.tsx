"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { isActivePath } from "./navigation";

/** A nav link that marks the current page with aria-current and an underline (not color alone). */
export function NavLink({
  href,
  className,
  exact = false,
  ...rest
}: ComponentProps<typeof Link> & { exact?: boolean }) {
  const pathname = usePathname();
  const active = typeof href === "string" && isActivePath(pathname, href, exact);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "hover:text-brand font-semibold",
        !active && "link-underline",
        active && "text-brand underline decoration-2 underline-offset-8",
        className,
      )}
      {...rest}
    />
  );
}

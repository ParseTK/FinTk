"use client";

import { useId } from "react";
import type { NavItem } from "@/lib/navigation";
import { useDisclosure } from "@/lib/useDisclosure";
import { MenuIcon } from "../icons";
import { IconButton } from "../ui/IconButton";
import { NavLink } from "./NavLink";

/** Disclosure menu for small screens. Shown by the Navbar only when there are many links. */
export function MobileMenu({ items }: { items: readonly NavItem[] }) {
  const { open, toggle, close, buttonRef, containerProps } = useDisclosure();
  const panelId = useId();

  return (
    <div {...containerProps} className="relative sm:hidden">
      <IconButton
        ref={buttonRef}
        label="Menu"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
      >
        <MenuIcon />
      </IconButton>
      {open && (
        <ul
          id={panelId}
          className="border-border bg-surface-raised absolute right-0 z-20 mt-2 w-48 space-y-1 rounded-2xl border p-2 shadow-lg"
        >
          {items.map(({ href, label }) => (
            <li key={href}>
              <NavLink
                href={href}
                onClick={() => close()}
                className="hover:bg-surface block rounded-lg px-3 py-2"
              >
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

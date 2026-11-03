"use client";

import Link from "next/link";
import { useId } from "react";
import { useDisclosure } from "@/lib/useDisclosure";
import { SignOutButton } from "./SignOutButton";
import type { User } from "./types";

/** Two letters for the avatar circle. No picture is loaded: no third-party request, nothing to leak. */
export function initials(user: Pick<User, "name" | "email">): string {
  const words = (user.name ?? "").trim().split(/\s+/).filter(Boolean);
  const letters =
    words.length >= 2
      ? `${words[0]![0]}${words[words.length - 1]![0]}`
      : (words[0] ?? user.email).slice(0, 2);
  return letters.toUpperCase();
}

export function AccountMenuView({ user, csrfToken }: { user: User; csrfToken: string }) {
  const { open, toggle, close, buttonRef, containerProps } = useDisclosure();
  const panelId = useId();

  return (
    <div {...containerProps} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Account menu"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        className="bg-brand text-on-accent flex size-9 items-center justify-center rounded-full text-sm font-semibold hover:opacity-90"
      >
        <span aria-hidden="true">{initials(user)}</span>
      </button>

      {open && (
        <div
          id={panelId}
          className="border-border bg-surface-raised animate-pop-in absolute right-0 z-20 mt-2 w-64 origin-top-right space-y-3 rounded-2xl border p-4 shadow-lg"
        >
          <div className="min-w-0">
            <p className="truncate font-semibold">{user.name ?? "Signed in"}</p>
            <p className="text-fg-muted truncate text-sm">{user.email}</p>
          </div>
          <Link
            href="/account"
            onClick={() => close()}
            className="text-fg hover:bg-surface block rounded-lg px-3 py-2 text-sm font-semibold"
          >
            Your account
          </Link>
          <SignOutButton csrfToken={csrfToken} />
        </div>
      )}
    </div>
  );
}

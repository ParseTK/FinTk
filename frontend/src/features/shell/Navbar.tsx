import clsx from "clsx";
import Link from "next/link";
import { Suspense } from "react";
import { COLLAPSE_AFTER } from "./navigation";
import { headerItems } from "./sections";
import { Feature } from "@/components/ui/Feature";
import { Logo } from "./Logo";
import { MobileMenu } from "./MobileMenu";
import { NavLink } from "./NavLink";
import { PalettePicker } from "@/features/appearance";
import { AccountMenu } from "@/features/auth";

/**
 * The header: the logo, one link per section (a section's own pages are in the sidebar), then the
 * account menu and the appearance picker.
 */
export function Navbar() {
  const items = headerItems();
  const collapse = items.length > COLLAPSE_AFTER;

  return (
    <header className="w-full px-4 py-4 sm:px-6 lg:px-8">
      <nav
        aria-label="Main"
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3"
      >
        <Link href="/" aria-label="Virello home">
          <Logo />
        </Link>
        <div className="flex items-center gap-4 sm:gap-6">
          <div
            className={clsx("items-center gap-4 sm:gap-6", collapse ? "hidden sm:flex" : "flex")}
          >
            {items.map(({ href, label, exact, alsoActive }) => (
              <NavLink key={href} href={href} exact={exact} alsoActive={alsoActive}>
                {label}
              </NavLink>
            ))}
          </div>
          {collapse && <MobileMenu items={items} />}
          <Feature flag="auth">
            {/* Streams in after the rest of the header, in a box the same size, so asking the API
                who is signed in never delays the page or makes the header jump. */}
            <Suspense fallback={<span aria-hidden="true" className="inline-block h-8 w-20" />}>
              <AccountMenu />
            </Suspense>
          </Feature>
          <Feature flag="palette">
            <PalettePicker />
          </Feature>
        </div>
      </nav>
    </header>
  );
}

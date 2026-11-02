import clsx from "clsx";
import Link from "next/link";
import { COLLAPSE_AFTER, NAV_ITEMS } from "./navigation";
import { Feature } from "@/components/ui/Feature";
import { Logo } from "./Logo";
import { MobileMenu } from "./MobileMenu";
import { NavLink } from "./NavLink";
import { PalettePicker } from "@/features/appearance";

export function Navbar() {
  const collapse = NAV_ITEMS.length > COLLAPSE_AFTER;

  return (
    <header className="w-full px-4 py-4 sm:px-6 lg:px-8">
      <nav aria-label="Main" className="flex items-center justify-between gap-4">
        <Link href="/" aria-label="Virello home">
          <Logo />
        </Link>
        <div className="flex items-center gap-4 sm:gap-6">
          <div className={clsx("items-center gap-6", collapse ? "hidden sm:flex" : "flex")}>
            {NAV_ITEMS.map(({ href, label }) => (
              <NavLink key={href} href={href}>
                {label}
              </NavLink>
            ))}
          </div>
          {collapse && <MobileMenu items={NAV_ITEMS} />}
          <Feature flag="palette">
            <PalettePicker />
          </Feature>
        </div>
      </nav>
    </header>
  );
}

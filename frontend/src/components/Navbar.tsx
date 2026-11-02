import clsx from "clsx";
import Link from "next/link";
import { COLLAPSE_AFTER, NAV_ITEMS } from "@/lib/navigation";
import { Logo } from "./Logo";
import { MobileMenu } from "./layout/MobileMenu";
import { NavLink } from "./layout/NavLink";
import { PalettePicker } from "./PalettePicker";

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
          <PalettePicker />
        </div>
      </nav>
    </header>
  );
}

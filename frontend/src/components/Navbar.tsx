import Link from "next/link";
import { Logo } from "./Logo";
import { PalettePicker } from "./PalettePicker";

export function Navbar() {
  return (
    <header className="w-full px-4 py-4 sm:px-6 lg:px-8">
      <nav aria-label="Main" className="flex items-center justify-between gap-4">
        <Link href="/" aria-label="Virello home">
          <Logo />
        </Link>
        <div className="flex items-center gap-4 sm:gap-6">
          <Link href="/search" className="hover:text-brand font-semibold">
            Search
          </Link>
          <PalettePicker />
        </div>
      </nav>
    </header>
  );
}
